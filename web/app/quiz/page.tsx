import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Quiz from "./Quiz";

export default async function QuizPage() {
  const session = await auth();
  if (!session) redirect("/sign-in");
  return <div style={{ zoom: 2/3 }}><Quiz isLoggedIn={true} /></div>;
}
