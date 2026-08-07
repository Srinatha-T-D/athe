import React from "react";
import { useNavigate } from "react-router-dom";

const EFFECTIVE_DATE = "August 6, 2026";

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <button
          onClick={() => navigate(-1)}
          className="text-violet-400 text-sm mb-8 hover:underline"
        >
          ← Back
        </button>

        <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
        <p className="text-sm text-slate-500 mb-10">Effective {EFFECTIVE_DATE}</p>

        <div className="space-y-8 text-sm leading-relaxed">
          <section>
            <p>
              ATHE ("we", "us", "our") operates athe.space, a chat service that connects
              people for real-time conversation. This Privacy Policy explains what
              information we collect, how we use it, and the choices you have.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">1. Information We Collect</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Account information:</strong> the email, display name, and password
                (stored as a salted hash, never in plain text) you provide when registering, or
                nothing beyond a temporary session identifier if you use a guest account.</li>
              <li><strong>Profile details:</strong> optional information you choose to add, such
                as location or gender.</li>
              <li><strong>Messages and media:</strong> the text messages you send, and any
                images, gifs, or audio clips you upload and share in a chat.</li>
              <li><strong>Usage data:</strong> online/offline status, timestamps of activity, and
                basic technical data (IP address, browser type) collected automatically to keep
                the service secure and working.</li>
              <li><strong>Cookies and local storage:</strong> we use browser storage to keep you
                signed in and to remember basic preferences.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">2. How We Use Information</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>To provide, operate, and maintain the chat service.</li>
              <li>To connect you with other users and deliver your messages.</li>
              <li>To keep the service secure, prevent abuse, and enforce our Terms of Service.</li>
              <li>To communicate with you about your account when necessary.</li>
              <li>To display advertising through Google AdSense (see Section 5).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">3. How We Store and Share Information</h2>
            <p>
              Messages and account data are stored on secured servers. Uploaded media
              (images, gifs, and audio) is stored using Amazon Web Services (AWS) cloud
              storage. We do not sell your personal information. We may share information
              with service providers who help us operate the platform (such as our cloud
              hosting provider), or when required by law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">4. Data Retention</h2>
            <p>
              We retain account and message data for as long as your account is active.
              You can request deletion of your account and associated data by contacting us
              using the details in Section 7.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">5. Advertising and Third-Party Services</h2>
            <p>
              We may use Google AdSense to display advertisements. Google and its partners
              may use cookies and similar technologies to serve ads based on your visits to
              this and other websites. You can learn more about how Google uses data and opt
              out of personalized advertising at{" "}
              <a
                href="https://policies.google.com/technologies/ads"
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-400 hover:underline"
              >
                policies.google.com/technologies/ads
              </a>{" "}
              and manage your ad preferences at{" "}
              <a
                href="https://adssettings.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-400 hover:underline"
              >
                adssettings.google.com
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">6. Your Choices</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>You can update or delete your profile information from your account settings.</li>
              <li>You can request a copy or deletion of your data by contacting us.</li>
              <li>You can control cookie and ad-personalization settings through your browser
                and through Google's Ad Settings linked above.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">7. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy or want to exercise your data
              rights, contact us at{" "}
              <a href="mailto:privacy@athe.space" className="text-violet-400 hover:underline">
                privacy@athe.space
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">8. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will post any changes
              on this page with a revised effective date.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
