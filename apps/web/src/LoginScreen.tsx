import { useState, type FormEvent } from "react";
import * as validation from "@astrelune/validation";

type LoginErrors = Partial<Record<"email" | "password", string>>;

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<LoginErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError(null);

    const parsed = validation.loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const nextErrors: LoginErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string" && !nextErrors[field as keyof LoginErrors]) {
          nextErrors[field as keyof LoginErrors] = issue.message;
        }
      }
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);
    try {
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(parsed.data),
      });

      if (response.status === 401) {
        setServerError("Invalid email or password.");
        return;
      }

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setServerError(body?.error?.message ?? "Login failed. Please try again.");
        return;
      }

      window.location.assign(window.location.pathname);
    } catch {
      setServerError("Login failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="registration-screen">
      <section className="registration-card">
        <h1>Enter the Sanctuary</h1>
        {serverError ? (
          <p className="registration-error" role="alert">
            {serverError}
          </p>
        ) : null}
        <form onSubmit={handleSubmit} noValidate>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={Boolean(errors.email)}
            />
            {errors.email ? <span className="field-error">{errors.email}</span> : null}
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={Boolean(errors.password)}
            />
            {errors.password ? <span className="field-error">{errors.password}</span> : null}
          </label>

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Log in"}
          </button>
        </form>
      </section>
    </main>
  );
}
