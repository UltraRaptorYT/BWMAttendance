import { Suspense } from "react";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="fullHeight w-full flex items-center justify-center">
          Loading login...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
