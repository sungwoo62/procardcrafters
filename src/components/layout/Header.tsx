"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X, Heart, Printer } from "lucide-react";
import { getWishlist } from "@/lib/wishlist";

const NAV_LINKS = [
  { href: "/products", label: "Products" },
  { href: "/quote", label: "Get a Quote" },
];

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setWishlistCount(getWishlist().length);
    const onStorage = () => setWishlistCount(getWishlist().length);
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 bg-white transition-shadow duration-200 ${
        scrolled ? "shadow-md border-b-0" : "border-b border-border"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white group-hover:bg-primary-dark transition-colors">
            <Printer size={16} strokeWidth={2} />
          </div>
          <span className="text-lg font-extrabold tracking-tight text-text">
            Pro<span className="text-primary">Card</span>Crafters
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-secondary hover:text-text transition-colors relative after:absolute after:bottom-[-2px] after:left-0 after:h-[2px] after:w-0 after:bg-primary after:transition-all hover:after:w-full"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/wishlist"
            className="relative flex items-center gap-1 text-sm font-medium text-secondary hover:text-text transition-colors"
            aria-label="찜 목록"
          >
            <Heart size={18} strokeWidth={1.75} />
            {wishlistCount > 0 && (
              <span className="absolute -top-2 -right-2 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                {wishlistCount}
              </span>
            )}
          </Link>
          <Link
            href="/quote"
            className="inline-flex items-center rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary-dark transition-colors shadow-sm"
          >
            Get a Quote
          </Link>
        </nav>

        {/* Mobile toggle */}
        <button
          type="button"
          className="md:hidden p-2 text-secondary hover:text-text rounded-lg hover:bg-bg-light transition-colors"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-border bg-white md:hidden shadow-lg">
          <nav className="flex flex-col gap-1 px-4 py-4">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-xl px-4 py-3 text-sm font-medium text-secondary hover:bg-bg-light hover:text-text transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/wishlist"
              className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-secondary hover:bg-bg-light hover:text-text transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              <Heart size={16} />
              Wishlist
              {wishlistCount > 0 && (
                <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {wishlistCount}
                </span>
              )}
            </Link>
            <Link
              href="/quote"
              className="mt-2 rounded-xl bg-primary px-5 py-3 text-center text-sm font-bold text-white hover:bg-primary-dark transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              Get a Quote
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
