import { Dashboard } from "@/components/Dashboard";

export default function Page() {
  const instanceName =
    process.env.NEXT_PUBLIC_INSTANCE_NAME ?? "Unknown Instance";
  return <Dashboard instanceName={instanceName} />;
}
