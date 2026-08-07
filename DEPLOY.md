# Deploying ATHE to AWS (EKS + ECR + DocumentDB + ElastiCache)

This walks through taking the app from zero to a running, autoscaling,
TLS-terminated deployment on AWS. Steps use the AWS CLI and `eksctl`
directly rather than Terraform, so you can follow along without extra
tooling - the k8s manifests in `k8s/` are the reusable, source-controlled
part regardless of how you provision the cluster.

**Prerequisites:** AWS CLI v2, `eksctl`, `kubectl`, `docker`, an AWS account
with permissions to create EKS/ECR/DocumentDB/ElastiCache/IAM resources, and
a domain you control (for TLS via ACM + Route53).

---

## 0. Architecture

```
Internet -> ALB (Ingress) -> Service: athe-frontend (nginx, static React build)
                           -> Service: athe-backend  (FastAPI, REST + WebSocket)
                                          |                 |
                                     DocumentDB          ElastiCache
                                     (MongoDB-compatible)  (Redis - WS fan-out
                                                             across pods)
```

The backend runs 2-8 replicas (HPA). Because a user's WebSocket can land on
any pod, message delivery goes through Redis pub/sub (`backend/server.py`,
`ConnectionManager`) rather than assuming an in-memory connection map - this
is why ElastiCache is required, not optional, once you're on more than one
replica.

---

## 1. Create an ECR repository for each image

```bash
aws ecr create-repository --repository-name athe-backend  --region us-east-1
aws ecr create-repository --repository-name athe-frontend --region us-east-1
```

## 2. Build and push the images

```bash
export AWS_REGION=us-east-1
export ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

docker build -t $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/athe-backend:latest ./backend
docker push $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/athe-backend:latest

# Frontend image is environment-agnostic at build time (see
# frontend/src/lib/config.js) - REACT_APP_BACKEND_URL is injected at
# container start, not baked in, so you don't need --build-arg here.
docker build -t $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/athe-frontend:latest ./frontend
docker push $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/athe-frontend:latest
```

## 3. Create the EKS cluster

```bash
eksctl create cluster \
  --name athe-cluster \
  --region $AWS_REGION \
  --nodegroup-name athe-workers \
  --node-type t3.medium \
  --nodes 2 --nodes-min 2 --nodes-max 4 \
  --managed
```

This takes ~15-20 minutes and updates your local kubeconfig automatically.

## 4. Install the AWS Load Balancer Controller

Needed so the `Ingress` objects in `k8s/20-ingress.yaml` provision a real
ALB.

```bash
eksctl utils associate-iam-oidc-provider --cluster athe-cluster --approve

curl -o iam-policy.json https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/main/docs/install/iam_policy.json
aws iam create-policy --policy-name AWSLoadBalancerControllerIAMPolicy --policy-document file://iam-policy.json

eksctl create iamserviceaccount \
  --cluster athe-cluster \
  --namespace kube-system \
  --name aws-load-balancer-controller \
  --attach-policy-arn arn:aws:iam::$ACCOUNT_ID:policy/AWSLoadBalancerControllerIAMPolicy \
  --approve

helm repo add eks https://aws.github.io/eks-charts
helm repo update
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=athe-cluster \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller
```

## 5. Provision DocumentDB (MongoDB-compatible)

```bash
aws docdb create-db-cluster \
  --db-cluster-identifier athe-docdb \
  --engine docdb \
  --master-username athe \
  --master-user-password "<CHOOSE_A_STRONG_PASSWORD>" \
  --vpc-security-group-ids <SG_ALLOWING_EKS_NODES> \
  --db-subnet-group-name <YOUR_DB_SUBNET_GROUP>

aws docdb create-db-instance \
  --db-instance-identifier athe-docdb-1 \
  --db-cluster-identifier athe-docdb \
  --db-instance-class db.t3.medium \
  --engine docdb
```

DocumentDB requires TLS by default. The connection string goes in
`k8s/01-secret.yaml` as `MONGO_URL`; you'll also need the Amazon CA bundle
mounted into the backend pod - add this to `k8s/10-backend-deployment.yaml`:

```yaml
volumeMounts:
  - name: docdb-ca
    mountPath: /opt/docdb-ca
volumes:
  - name: docdb-ca
    configMap:
      name: docdb-ca-bundle
```

and create the ConfigMap from the [Amazon RDS combined CA bundle](https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem),
then append `&tlsCAFile=/opt/docdb-ca/global-bundle.pem` to `MONGO_URL`.

*(Simpler alternative for getting started: use a free-tier MongoDB Atlas
cluster instead of DocumentDB - just drop its `MONGO_URL` into the secret,
no CA bundle needed.)*

## 6. Provision ElastiCache for Redis

```bash
aws elasticache create-replication-group \
  --replication-group-id athe-redis \
  --replication-group-description "athe chat websocket fanout" \
  --engine redis \
  --cache-node-type cache.t3.micro \
  --num-cache-clusters 2 \
  --automatic-failover-enabled \
  --security-group-ids <SG_ALLOWING_EKS_NODES> \
  --cache-subnet-group-name <YOUR_CACHE_SUBNET_GROUP>
```

Grab the primary endpoint once available and use it as `REDIS_URL` in
`k8s/01-secret.yaml`. Once ElastiCache is in place, delete `05-redis.yaml`
from `k8s/kustomization.yaml` (or just don't apply it) - no need for the
in-cluster fallback anymore.

## 7. Set up GitHub Actions OIDC (for CI/CD, no long-lived AWS keys)

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1

# Create a role trusting that provider, scoped to your repo, with permissions
# for ecr:*, eks:DescribeCluster, and an aws-auth mapping so it can kubectl.
# Full policy JSON: https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services
```

Add the resulting role ARN as the `AWS_DEPLOY_ROLE_ARN` secret in your GitHub
repo settings - `.github/workflows/deploy.yml` uses it to build, push, and
roll out on every push to `main`.

## 8. Deploy to the cluster

```bash
kubectl create namespace athe-chat --dry-run=client -o yaml | kubectl apply -f -

cp k8s/01-secret.example.yaml k8s/01-secret.yaml
# edit k8s/01-secret.yaml with real MONGO_URL / JWT_SECRET / REDIS_URL
# (this file is gitignored - never commit it)

# Edit k8s/02-configmap.yaml, k8s/10-*, k8s/11-* to point at your real
# ECR account ID/region and domain, and k8s/20-ingress.yaml with your
# ACM certificate ARN and hostname.

kubectl apply -k k8s/
kubectl -n athe-chat get pods -w
```

Once pods are `Running` and `1/1 Ready`:

```bash
kubectl -n athe-chat get ingress
# Note the ALB DNS name, then create a Route53 CNAME/alias from your domain to it.
```

## 9. Verify

```bash
curl https://chat.example.com/api/health
curl https://chat.example.com/api/health/ready
```

Open `https://chat.example.com` in two different browsers (or incognito
windows) as two different users - message delivery between them exercises
the Redis-backed WebSocket fan-out across whichever pods each session lands
on.

---

## Operational notes

- **Scaling:** the HPA scales the backend 2-8 replicas on CPU/memory; adjust
  `k8s/10-backend-deployment.yaml` if your traffic profile differs.
- **Secrets:** `k8s/01-secret.yaml` is a plain k8s Secret (base64, not
  encrypted at rest by default). For real production, look at AWS Secrets
  Manager + the External Secrets Operator, or enable EKS secrets encryption
  with a KMS key.
- **Logs:** both containers log to stdout/stderr (`gunicorn --access-logfile -`,
  nginx defaults) - wire these into CloudWatch via the Fluent Bit EKS add-on
  if you want centralized logging.
- **Rolling updates:** both Deployments use `maxUnavailable: 0` so you never
  drop below full capacity during a rollout; the CI/CD pipeline's
  `kubectl set image` + `rollout status` steps will fail the build if a
  rollout doesn't succeed within 180s.
