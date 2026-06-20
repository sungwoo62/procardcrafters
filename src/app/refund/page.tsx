import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Refund & Cancellation Policy — Procardcrafters',
  description:
    'How cancellations, refunds, reprints, and quality claims work for custom-printed orders at Procardcrafters.',
}

const LAST_UPDATED = 'June 20, 2026'

export default function RefundPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Refund &amp; Cancellation Policy</h1>
      <p className="text-sm text-gray-500 mb-10">Last updated: {LAST_UPDATED}</p>

      <div className="prose prose-gray max-w-none space-y-8 text-gray-600 leading-relaxed">
        <section>
          <p>
            Every Procardcrafters order is custom-printed to your specifications. Because each item is made to order and
            cannot be resold, our cancellation and refund terms differ from those of off-the-shelf retail products. This
            policy explains when an order can be cancelled, when a refund or reprint applies, and how to raise a quality
            claim. It works alongside our{' '}
            <Link href="/terms" className="text-blue-600 hover:underline">Terms of Service</Link>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Cancellation Window</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Before production begins.</strong> If your order has not yet entered production, you may request a
              cancellation for a full refund.
            </li>
            <li>
              <strong>After production begins.</strong> Once your file passes review and production starts, the order
              generally cannot be cancelled, because materials and press time have already been committed. Partial
              refunds are not available for orders in production.
            </li>
            <li>
              Production typically begins shortly after payment is received and your file passes review, so please
              request any cancellation as early as possible.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Custom-Print Items Are Non-Refundable</h2>
          <p>
            Custom-printed products are made specifically for you and cannot be returned for a refund simply because you
            changed your mind, ordered the wrong quantity, or supplied an incorrect design file. We encourage you to
            review your configuration, proof, and uploaded file carefully before paying. Responsibility for file
            quality and content rests with the customer, as described in our{' '}
            <Link href="/terms" className="text-blue-600 hover:underline">Terms of Service</Link>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Quality Defects &amp; Reprints</h2>
          <p>
            We stand behind our print quality. If your order arrives with a manufacturing defect — such as a printing
            error on our part, a material flaw, or damage in transit — we will reprint or refund the affected items at
            no additional cost to you. Eligible issues include:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Printing that does not match the approved proof or file we produced from.</li>
            <li>Defects in materials, cutting, folding, or finishing performed by our facility.</li>
            <li>Items that arrive physically damaged due to handling or shipping.</li>
          </ul>
          <p>
            Issues caused by customer-supplied files (low resolution, incorrect color mode, missing bleed, typos, or
            wrong content) are not eligible, as final file responsibility lies with the customer.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">4. How to Submit a Claim</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Contact us within <strong>14 days</strong> of delivery through our{' '}
              <Link href="/contact" className="text-blue-600 hover:underline">contact form</Link>.
            </li>
            <li>Include your order number and a clear description of the issue.</li>
            <li>
              Attach photos of the affected items (and the shipping box, if the damage occurred in transit) so our team
              can assess the claim quickly.
            </li>
            <li>
              We may ask you to return or dispose of defective items as part of resolving the claim.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">5. How Refunds Are Issued</h2>
          <p>
            Approved refunds are returned to your original payment method. Once a refund is processed, it may take
            several business days for your bank or payment provider to post the credit. Shipping charges and import
            duties or taxes paid to carriers or customs authorities are generally non-refundable, except where the
            entire order is cancelled before production or where required by law. See our{' '}
            <Link href="/shipping" className="text-blue-600 hover:underline">International Shipping, Customs &amp; Duties</Link>{' '}
            page for details on duties and taxes.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Questions</h2>
          <p>
            If you have any questions about a cancellation, refund, or quality claim, please reach out through our{' '}
            <Link href="/contact" className="text-blue-600 hover:underline">contact form</Link> and our team will be
            happy to help.
          </p>
        </section>
      </div>
    </div>
  )
}
