import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — Procardcrafters',
  description: 'How Procardcrafters collects, uses, and protects your personal information.',
}

const LAST_UPDATED = 'June 6, 2026'

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-10">Last updated: {LAST_UPDATED}</p>

      <div className="prose prose-gray max-w-none space-y-8 text-gray-600 leading-relaxed">
        <section>
          <p>
            This Privacy Policy explains how Procardcrafters (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) collects, uses, and
            protects your information when you use our website at{' '}
            <a href="https://procardcrafters.com" className="text-blue-600 hover:underline">procardcrafters.com</a>{' '}
            and our printing and fulfillment services. By using our services, you agree to the practices described here.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Information We Collect</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Account information.</strong> When you sign in with Google, we receive your name, email address, and profile picture from your Google account.</li>
            <li><strong>Order information.</strong> Products you configure, quantities, shipping address, and order history.</li>
            <li><strong>Uploaded files.</strong> Design files (PDF, AI, PSD, images) you upload for printing.</li>
            <li><strong>Payment information.</strong> Payments are processed by our payment provider. We do not store your full card details on our servers.</li>
            <li><strong>Usage data.</strong> Device, browser, IP address, and interaction data collected via cookies and analytics tools.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">2. How We Use Your Information</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>To create and manage your account and authenticate sign-in.</li>
            <li>To process, produce, and ship your orders.</li>
            <li>To provide order updates, tracking, and customer support.</li>
            <li>To improve our products, website, and service quality.</li>
            <li>To detect, prevent, and address fraud or security issues.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Google User Data</h2>
          <p>
            When you sign in with Google, we access only your basic profile (name, email address, and profile photo) for
            the purpose of creating your account and identifying you. Our use of information received from Google APIs
            adheres to the{' '}
            <a href="https://developers.google.com/terms/api-services-user-data-policy" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
              Google API Services User Data Policy
            </a>, including the Limited Use requirements. We do not sell Google user data, and we do not use it for
            advertising. You can revoke our access at any time from your{' '}
            <a href="https://myaccount.google.com/connections" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">Google Account permissions</a>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">4. How We Share Information</h2>
          <p>We share information only as needed to operate our services, with:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Service providers</strong> for hosting, authentication, and database storage.</li>
            <li><strong>Payment processors</strong> to complete transactions.</li>
            <li><strong>Shipping carriers</strong> (such as FedEx) to deliver your orders.</li>
            <li><strong>Analytics providers</strong> to understand and improve site usage.</li>
            <li><strong>Authorities</strong> when required by law or to protect our rights.</li>
          </ul>
          <p>We do not sell your personal information.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Cookies &amp; Analytics</h2>
          <p>
            We use cookies and similar technologies for essential site functionality and to measure performance. We may
            use analytics and marketing tools (such as Google Analytics, Meta Pixel, TikTok Pixel, and Microsoft Clarity).
            You can control cookies through your browser settings.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Data Retention</h2>
          <p>
            We retain your information for as long as your account is active or as needed to provide services, comply with
            legal obligations, resolve disputes, and enforce our agreements. You may request deletion of your account data
            at any time.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Your Rights</h2>
          <p>
            Depending on your location, you may have the right to access, correct, export, or delete your personal data,
            and to object to or restrict certain processing. To exercise these rights, contact us using the details below.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Security</h2>
          <p>
            We use industry-standard safeguards, including encryption in transit, to protect your information. However, no
            method of transmission or storage is completely secure, and we cannot guarantee absolute security.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Children&apos;s Privacy</h2>
          <p>
            Our services are not directed to children under 13, and we do not knowingly collect personal information from
            them. If you believe a child has provided us information, please contact us.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will post the updated version on this page and revise
            the &quot;Last updated&quot; date above.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Contact Us</h2>
          <p>
            If you have questions about this Privacy Policy or your data, please reach out through our{' '}
            <a href="/contact" className="text-blue-600 hover:underline">Contact page</a>.
          </p>
        </section>
      </div>
    </div>
  )
}
