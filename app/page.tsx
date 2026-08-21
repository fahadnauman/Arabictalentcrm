import { redirect } from "next/navigation";

// Root "/" always bounces to /login.
// The middleware will let authenticated users through to their dashboards later.
export default function Home() {
  redirect("/login");
}
