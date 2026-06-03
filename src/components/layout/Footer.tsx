import Link from "next/link";
import { Printer, Mail, Phone } from "lucide-react";

const FOOTER_LINKS = {
  Products: [
    { href: "/products?category=business-cards", label: "Business Cards" },
    { href: "/products?category=flyers-leaflets", label: "Flyers & Leaflets" },
    { href: "/products?category=banners-displays", label: "Banners & Displays" },
    { href: "/products?category=stickers-labels", label: "Stickers & Labels" },
    { href: "/products?category=packaging", label: "Packaging" },
    { href: "/products?category=lanyards-accessories", label: "Lanyards & Accessories" },
  ],
  Company: [
    { href: "/quote", label: "Get a Quote" },
    { href: "/products", label: "All Products" },
    { href: "/wishlist", label: "Saved Items" },
  ],
};

export default function Footer() {
  return (
    <footer className="bg-bg-dark text-white">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2.5 group w-fit">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-white">
                <Printer size={18} strokeWidth={2} />
              </div>
              <span className="text-xl font-extrabold tracking-tight text-white">
                Pro<span className="text-accent">Card</span>Crafters
              </span>
            </Link>
            <p className="mt-4 text-sm leading-7 text-white/60 max-w-xs">
              Professional Print, Honest Prices. Premium quality printing for
              businesses of all sizes — fast turnaround, no hidden fees.
            </p>
            <div className="mt-6 space-y-2">
              <a
                href="mailto:hello@procardcrafters.com"
                className="flex items-center gap-2 text-sm text-white/50 hover:text-white/80 transition-colors"
              >
                <Mail size={14} />
                hello@procardcrafters.com
              </a>
              <a
                href="tel:+18005551234"
                className="flex items-center gap-2 text-sm text-white/50 hover:text-white/80 transition-colors"
              >
                <Phone size={14} />
                +1 (800) 555-1234
              </a>
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(FOOTER_LINKS).map(([title, links]) => (
            <div key={title}>
              <h3 className="text-xs font-bold uppercase tracking-widest text-white/40">
                {title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-white/60 hover:text-white transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 border-t border-white/10 pt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-xs text-white/30">
            &copy; {new Date().getFullYear()} ProCardCrafters. All rights reserved.
          </p>
          <div className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-green-400" />
            <span className="text-xs text-white/30">All systems operational</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
