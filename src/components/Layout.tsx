import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-[#0a0f1e]">
      <Navbar />
      <main className="pt-16">{children}</main>
      <Footer />
    </div>
  );
}
