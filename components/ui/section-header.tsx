import { useColors } from "@/hooks/use-colors";
import { Heading } from "@/components/ui/heading";

export function SectionHeader({ title }: { title: string }) {
  const colors = useColors();
  return (
    <Heading
      level={2}
      style={{
        color: colors.muted,
        fontSize: 12,
        fontWeight: "600",
        textTransform: "uppercase",
        letterSpacing: 0.8,
        paddingHorizontal: 16,
        paddingTop: 20,
        paddingBottom: 8,
      }}
    >
      {title}
    </Heading>
  );
}
