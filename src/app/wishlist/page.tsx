import WishlistPage from "./WishlistPage";

export const metadata = { title: "찜 목록 | ProCardCrafters" };

export default function Page() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <WishlistPage />
    </div>
  );
}
