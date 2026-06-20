import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'International Shipping, Customs & Duties — Procardcrafters',
  description:
    'How worldwide FedEx shipping, delivery estimates, import duties, VAT, and customs clearance work for Procardcrafters orders.',
}

const LAST_UPDATED = 'June 20, 2026'

export default function ShippingPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">International Shipping, Customs &amp; Duties</h1>
      <p className="text-sm text-gray-500 mb-10">Last updated: {LAST_UPDATED}</p>

      <div className="prose prose-gray max-w-none space-y-8 text-gray-600 leading-relaxed">
        <section>
          <p>
            Procardcrafters produces your order at certified global facilities and ships worldwide via FedEx. This page
            explains delivery estimates, shipping costs, and how import duties, taxes, and customs clearance work for
            international orders. It works alongside our{' '}
            <Link href="/terms" className="text-blue-600 hover:underline">Terms of Service</Link> and{' '}
            <Link href="/refund" className="text-blue-600 hover:underline">Refund &amp; Cancellation Policy</Link>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Production &amp; Delivery Estimates</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Production lead time.</strong> Standard production is typically 7–10 business days; express
              upgrades may be available at checkout for selected products.
            </li>
            <li>
              <strong>Transit time.</strong> International delivery via FedEx typically takes several business days after
              dispatch, depending on your destination.
            </li>
            <li>
              All timeframes are estimates, not guarantees. Production and transit times may vary based on the product,
              destination, carrier conditions, and customs processing.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Shipping Costs</h2>
          <p>
            Shipping is billed separately from product pricing and is calculated based on weight, dimensions, and
            destination. The shipping charge for your order is shown before payment. Shipping charges are generally
            non-refundable once an order has shipped.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Import Duties, VAT &amp; Taxes</h2>
          <p>
            For international shipments, the price you pay to Procardcrafters covers your products and the shipping
            service only. It does <strong>not</strong> include any import duties, customs fees, VAT, GST, or other taxes
            levied by the destination country.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>The recipient is responsible</strong> for all import duties, taxes, and customs charges assessed by
              their local authorities.
            </li>
            <li>
              These charges are determined by your country&apos;s customs office, not by Procardcrafters, and are usually
              collected by FedEx or the customs authority before or upon delivery.
            </li>
            <li>
              Duty and tax amounts vary by destination, product type, and declared value. If you are unsure of the
              charges that may apply, please check with your local customs office before ordering.
            </li>
            <li>
              Import duties and taxes paid to carriers or customs authorities are not refundable by Procardcrafters.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Customs Clearance &amp; Delays</h2>
          <p>
            All international shipments are subject to inspection and clearance by the destination country&apos;s customs
            authorities. Clearance can introduce delays that are outside our control. Procardcrafters is not responsible
            for delays caused by customs processing, incomplete or inaccurate recipient information, or refusal to pay
            applicable duties and taxes. If a shipment is returned to us because duties were unpaid or delivery was
            refused, any re-shipment may incur additional charges.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Tracking, Address Accuracy &amp; Issues</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Once your order ships, you can follow its status from your{' '}
              <Link href="/orders" className="text-blue-600 hover:underline">order status</Link> page.
            </li>
            <li>
              Please ensure your shipping address and contact details are accurate. We are not responsible for shipments
              delayed or lost due to an incorrect or incomplete address provided at checkout.
            </li>
            <li>
              If your shipment is delayed beyond the expected window, lost, or arrives damaged, contact us through our{' '}
              <Link href="/contact" className="text-blue-600 hover:underline">contact form</Link> and we will work with
              the carrier to help resolve it.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Questions</h2>
          <p>
            For any questions about shipping, delivery estimates, or customs, please reach out through our{' '}
            <Link href="/contact" className="text-blue-600 hover:underline">contact form</Link>.
          </p>
        </section>
      </div>
    </div>
  )
}
