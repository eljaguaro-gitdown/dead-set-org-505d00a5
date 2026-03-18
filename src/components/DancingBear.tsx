const DancingBear = ({ color = "primary" }: { color?: "primary" | "gold" | "blue" }) => {
  const colorMap = {
    primary: "text-primary",
    gold: "text-accent",
    blue: "text-secondary",
  };

  return (
    <span className={`dancing-bear inline-block ${colorMap[color]}`} aria-hidden="true">
      🐻
    </span>
  );
};

export default DancingBear;
