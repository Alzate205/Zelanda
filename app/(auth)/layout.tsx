export default function LayoutAuth({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zelanda-beige-50 text-zelanda-verde-900">
      {children}
    </div>
  );
}
