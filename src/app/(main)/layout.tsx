import Footer from './components/footer';
import Header from './components/header';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <Header />
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      <Footer />
    </div>
  );
}
