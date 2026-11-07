import { auth } from "@/lib/auth";
import Quiz from "./Quiz";

export default async function QuizPage() {
  const session = await auth();
  return <Quiz isLoggedIn={!!session} />;
}
