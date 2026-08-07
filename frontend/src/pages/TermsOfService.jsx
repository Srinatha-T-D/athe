import React from "react";
import { useNavigate } from "react-router-dom";

const EFFECTIVE_DATE = "August 6, 2026";

export default function TermsOfService() {
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

        <h1 className="text-3xl font-bold text-white mb-2">Terms of Service</h1>
        <p className="text-sm text-slate-500 mb-10">Effective {EFFECTIVE_DATE}</p>

        <div className="space-y-8 text-sm leading-relaxed">
          <section>
            <p>
              Welcome to ATHE. By creating an account or using athe.space (the "Service"),
              you agree to these Terms of Service. If you do not agree, please do not use
              the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">1. Eligibility</h2>
            <p>
              You must be at least 18 years old to use this Service. By using ATHE, you
              confirm that you meet this requirement and that you are legally permitted to
              use the Service in your jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">2. Your Account</h2>
            <p>
              You are responsible for maintaining the confidentiality of your login
              credentials and for all activity under your account. You agree to provide
              accurate information and to notify us of any unauthorized use of your account.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">3. Acceptable Use</h2>
            <p>You agree not to use the Service to:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>Harass, threaten, abuse, or harm another user.</li>
              <li>Post or share sexually explicit content, content involving minors, or
                content that sexualizes any person.</li>
              <li>Share content that is illegal, defamatory, hateful, or that promotes
                violence or discrimination.</li>
              <li>Impersonate another person or misrepresent your identity or age.</li>
              <li>Upload viruses, malware, or attempt to compromise the security of the
                Service.</li>
              <li>Use the Service for spam, scams, phishing, or unsolicited advertising.</li>
              <li>Upload video files or other content types not supported by the media
                attachment feature (images, gifs, and audio only).</li>
              <li>Attempt to scrape, reverse-engineer, or interfere with the normal operation
                of the Service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">4. Content You Share</h2>
            <p>
              You retain ownership of the messages, images, gifs, and audio clips you send.
              By sharing content through the Service, you grant us a limited license to
              store, transmit, and display that content solely for the purpose of operating
              the Service (for example, delivering your message to the recipient). We do not
              claim ownership of your content, and we do not use it for any purpose beyond
              operating and securing the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">5. Moderation and Enforcement</h2>
            <p>
              We may remove content, suspend, or terminate accounts that violate these Terms,
              at our discretion, with or without notice. Because ATHE connects strangers in
              real time, we encourage caution: do not share personal or financial information
              with people you meet on the Service, and report abusive behavior to us.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">6. Advertising</h2>
            <p>
              The Service may display third-party advertisements, including through Google
              AdSense. We are not responsible for the content of third-party ads. See our{" "}
              <a href="/privacy" className="text-violet-400 hover:underline">Privacy Policy</a>{" "}
              for details on how advertising cookies are used.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">7. Disclaimer and Limitation of Liability</h2>
            <p>
              The Service is provided "as is" without warranties of any kind. We are not
              responsible for the conduct of any user, on or off the platform. To the fullest
              extent permitted by law, ATHE and its operators are not liable for any indirect,
              incidental, or consequential damages arising from your use of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">8. Changes to the Service or Terms</h2>
            <p>
              We may modify or discontinue the Service, or update these Terms, at any time.
              Continued use of the Service after changes take effect constitutes acceptance
              of the revised Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">9. Contact Us</h2>
            <p>
              Questions about these Terms? Contact us at{" "}
              <a href="mailto:support@athe.space" className="text-violet-400 hover:underline">
                support@athe.space
              </a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
