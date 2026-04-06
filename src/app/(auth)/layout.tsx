import Image from 'next/image';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="relative flex min-h-screen w-full items-center justify-center p-4">
      <Image
        src="https://picsum.photos/seed/authbg/1920/1080"
        alt="Abstract background"
        fill
        className="object-cover -z-10 brightness-[.2]"
        data-ai-hint="abstract dark"
      />
      {children}
    </main>
  );
}