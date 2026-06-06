import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service — Procardcrafters',
  description: 'The terms and conditions governing your use of Procardcrafters services.',
}

const LAST_UPDATED = 'June 6, 2026'

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
      <p className="text-sm text-gray-500 mb-10">Last updated: {LAST_UPDATED}</p>

      <div className="prose prose-gray max-w-none space-y-8 text-gray-600 leading-relaxed">
        <section>
          <p>
            These Terms of Service (&quot;Terms&quot;) govern your access to and use of the Procardcrafters website at{' '}
            <a href="https://procardcrafters.com" className="text-blue-600 hover:underline">procardcrafters.com</a>{' '}
            and our printing and fulfillment services. By using our services, you agree to these Terms. If you do not
            agree, please do not use our services.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Services</h2>
          <p>
            Procardcrafters provides on-demand printing of products such as business cards, stickers, flyers, postcards,
            and posters, along with worldwide shipping. We may modify, suspend, or discontinue any part of our services at
            any time.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Accounts</h2>
          <p>
            You may need an account to place orders. You are responsible for keeping your account credentials secure and
            for all activity under your account. You must provide accurate information and promptly update it as needed.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Orders &amp; Payment</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>All prices are shown in USD and may change without notice.</li>
            <li>Payment is required before production begins.</li>
            <li>Your order is confirmed once payment is received and your file passes review.</li>
            <li>We reserve the right to refuse or cancel any order, including for suspected fraud or content violations.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Your Content &amp; Files</h2>
          <p>
            You retain ownership of the design files you upload. By submitting files, you grant us a limited license to
            reproduce and print them solely to fulfill your order. You represent and warrant that you own or have the
            rights to all content you submit and that it does not infringe any third party&apos;s intellectual property,
            privacy, or other rights.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Prohibited Content</h2>
          <p>
            You may not submit content that is illegal, infringing, defamatory, hateful, or otherwise objectionable. We may
            reject or remove any order that violates these Terms, applicable law, or third-party rights.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Production &amp; Shipping</h2>
          <p>
            Products are produced at the most suitable facility in our global network. Production and delivery timelines
            are estimates and may vary based on the product, destination, and carrier conditions. Shipping is billed
            separately at checkout, and title and risk of loss pass to you upon delivery to the carrier.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Cancellations &amp; Refunds</h2>
          <p>
            Because products are custom-printed to your specifications, orders generally cannot be cancelled or refunded
            once production has begun. If your order arrives defective or does not meet our quality standards, contact us
            and we will reprint or refund the affected items.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Disclaimers</h2>
          <p>
            Our services are provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind,
            whether express or implied, to the fullest extent permitted by law. Minor variations in color, cut, and finish
            are inherent to the printing process and are not considered defects.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, Procardcrafters shall not be liable for any indirect, incidental, or
            consequential damages. Our total liability for any claim relating to an order shall not exceed the amount you
            paid for that order.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Changes to These Terms</h2>
          <p>
            We may update these Terms from time to time. The updated version will be posted on this page with a revised
            &quot;Last updated&quot; date. Your continued use of our services constitutes acceptance of the updated Terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Contact Us</h2>
          <p>
            Questions about these Terms? Reach us through our{' '}
            <a href="/contact" className="text-blue-600 hover:underline">Contact page</a>.
          </p>
        </section>
      </div>
    </div>
  )
}
