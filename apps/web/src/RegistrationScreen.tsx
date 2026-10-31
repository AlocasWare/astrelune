import { useState, type FormEvent } from "react";
import * as validation from "@astrelune/validation";

type RegistrationErrors = Partial<
  Record<"email" | "displayName" | "password" | "confirmPassword", string>
>;

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export function RegistrationScreen() {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<RegistrationErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError(null);

    const parsed = validation.registerUserSchema.safeParse({
      email,
      displayName,
      password,
      confirmPassword,
    });

    if (!parsed.success) {
      const nextErrors: RegistrationErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string" && !nextErrors[field as keyof RegistrationErrors]) {
          nextErrors[field as keyof RegistrationErrors] = issue.message;
        }
      }
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);
    try {
      const response = await fetch(`${apiUrl}/auth/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(parsed.data),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setServerError(body?.error?.message ?? "Registration failed. Please try again.");
        return;
      }

      setSuccess(true);
      setEmail("");
      setDisplayName("");
      setPassword("");
      setConfirmPassword("");
    } catch {
      setServerError("Registration failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (success) {
    return (
      <main className="registration-screen">
        <section className="registration-card">
          <h1>Account created</h1>
          <p>Your Astrelune account is ready.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="registration-screen">
      <section className="registration-card">
        <h1>Create your account</h1>
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
            Display name
            <input
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              aria-invalid={Boolean(errors.displayName)}
            />
            {errors.displayName ? <span className="field-error">{errors.displayName}</span> : null}
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

          <label>
            Confirm password
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              aria-invalid={Boolean(errors.confirmPassword)}
            />
            {errors.confirmPassword ? (
              <span className="field-error">{errors.confirmPassword}</span>
            ) : null}
          </label>

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating account..." : "Register"}
          </button>
        </form>
      </section>
    </main>
  );
}
