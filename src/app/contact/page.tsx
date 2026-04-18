import { Metadata } from 'next'
import { Mail, Clock } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Contact Us - Procardcrafters',
  description: 'Get in touch with Procardcrafters for questions about orders, printing, or partnerships.',
}

export default function ContactPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-4 text-center">Contact Us</h1>
      <p className="text-gray-500 mb-10 text-center">
        Have a question about your order or need help with your design? We are here to help.
      </p>

      <div className="space-y-6">
        <div className="flex items-start gap-4 border border-gray-200 rounded-xl p-6 bg-white">
          <Mail className="w-6 h-6 text-blue-600 mt-0.5 shrink-0" />
          <div>
            <h2 className="font-semibold text-gray-900 mb-1">Email</h2>
            <a href="mailto:hello@procardcrafters.com" className="text-blue-600 hover:underline text-sm">
              hello@procardcrafters.com
            </a>
            <p className="text-sm text-gray-500 mt-1">We typically respond within 24 hours.</p>
          </div>
        </div>

        <div className="flex items-start gap-4 border border-gray-200 rounded-xl p-6 bg-white">
          <Clock className="w-6 h-6 text-blue-600 mt-0.5 shrink-0" />
          <div>
            <h2 className="font-semibold text-gray-900 mb-1">Business Hours</h2>
            <p className="text-sm text-gray-600">Monday - Friday, 9:00 AM - 6:00 PM (PT)</p>
            <p className="text-sm text-gray-500 mt-1">Closed on US federal holidays.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
