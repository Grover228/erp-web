import { useState } from "react";
import { supabase } from "./supabase";

type AuthPageProps = {
  onLogin: (email: string, password: string) => Promise<void>;
  loginLoading: boolean;
  loginError: string;
};

export default function AuthPage({
  onLogin,
  loginLoading,
  loginError,
}: AuthPageProps) {
  const [mode, setMode] = useState<"login" | "request">("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");

  const [requestLoading, setRequestLoading] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [requestSuccess, setRequestSuccess] = useState("");

  async function handleSubmitLogin(e: React.FormEvent) {
    e.preventDefault();
    await onLogin(email, password);
  }

  async function handleSubmitRequest(e: React.FormEvent) {
    e.preventDefault();

    try {
      setRequestLoading(true);
      setRequestError("");
      setRequestSuccess("");

      const { error } = await supabase.from("registration_requests").insert({
        full_name: fullName,
        email,
        password,
        phone,
        comment,
      });

      if (error) {
        throw error;
      }

      setRequestSuccess("Заявка отправлена. Ожидай подтверждения администратора.");
      setFullName("");
      setEmail("");
      setPassword("");
      setPhone("");
      setComment("");
    } catch (error) {
      setRequestError(
        error instanceof Error ? error.message : "Не удалось отправить заявку"
      );
    } finally {
      setRequestLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f3f4f6",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 460,
          background: "#fff",
          borderRadius: 16,
          border: "1px solid #e5e7eb",
          padding: 24,
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: "#111827",
            marginBottom: 8,
          }}
        >
          ERP
        </div>

        <div
          style={{
            color: "#6b7280",
            marginBottom: 20,
            lineHeight: 1.5,
          }}
        >
          {mode === "login"
            ? "Вход для одобренных пользователей"
            : "Отправь заявку на доступ в систему"}
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 20,
          }}
        >
          <button
            onClick={() => setMode("login")}
            style={{
              flex: 1,
              height: 42,
              borderRadius: 10,
              border: "1px solid #d1d5db",
              background: mode === "login" ? "#2563eb" : "#fff",
              color: mode === "login" ? "#fff" : "#111827",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Вход
          </button>

          <button
            onClick={() => setMode("request")}
            style={{
              flex: 1,
              height: 42,
              borderRadius: 10,
              border: "1px solid #d1d5db",
              background: mode === "request" ? "#2563eb" : "#fff",
              color: mode === "request" ? "#fff" : "#111827",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Заявка
          </button>
        </div>

        {mode === "login" && (
          <form onSubmit={handleSubmitLogin}>
            <div style={{ marginBottom: 14 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 14,
                  color: "#374151",
                  marginBottom: 6,
                }}
              >
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Введите email"
                required
                style={{
                  width: "100%",
                  height: 44,
                  borderRadius: 10,
                  border: "1px solid #d1d5db",
                  padding: "0 12px",
                  boxSizing: "border-box",
                  fontSize: 15,
                }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 14,
                  color: "#374151",
                  marginBottom: 6,
                }}
              >
                Пароль
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Введите пароль"
                required
                style={{
                  width: "100%",
                  height: 44,
                  borderRadius: 10,
                  border: "1px solid #d1d5db",
                  padding: "0 12px",
                  boxSizing: "border-box",
                  fontSize: 15,
                }}
              />
            </div>

            {loginError && (
              <div
                style={{
                  marginBottom: 16,
                  padding: 12,
                  borderRadius: 12,
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#991b1b",
                }}
              >
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={loginLoading}
              style={{
                width: "100%",
                height: 46,
                border: "none",
                borderRadius: 12,
                background: loginLoading ? "#93c5fd" : "#2563eb",
                color: "#fff",
                fontSize: 16,
                fontWeight: 700,
                cursor: loginLoading ? "default" : "pointer",
              }}
            >
              {loginLoading ? "Вход..." : "Войти"}
            </button>
          </form>
        )}

        {mode === "request" && (
          <form onSubmit={handleSubmitRequest}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", marginBottom: 6, fontSize: 14 }}>
                Имя
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                style={{
                  width: "100%",
                  height: 44,
                  borderRadius: 10,
                  border: "1px solid #d1d5db",
                  padding: "0 12px",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", marginBottom: 6, fontSize: 14 }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  width: "100%",
                  height: 44,
                  borderRadius: 10,
                  border: "1px solid #d1d5db",
                  padding: "0 12px",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", marginBottom: 6, fontSize: 14 }}>
                Пароль
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  width: "100%",
                  height: 44,
                  borderRadius: 10,
                  border: "1px solid #d1d5db",
                  padding: "0 12px",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", marginBottom: 6, fontSize: 14 }}>
                Телефон
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={{
                  width: "100%",
                  height: 44,
                  borderRadius: 10,
                  border: "1px solid #d1d5db",
                  padding: "0 12px",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 6, fontSize: 14 }}>
                Комментарий
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                style={{
                  width: "100%",
                  borderRadius: 10,
                  border: "1px solid #d1d5db",
                  padding: "12px",
                  boxSizing: "border-box",
                  resize: "vertical",
                }}
              />
            </div>

            {requestError && (
              <div
                style={{
                  marginBottom: 16,
                  padding: 12,
                  borderRadius: 12,
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#991b1b",
                }}
              >
                {requestError}
              </div>
            )}

            {requestSuccess && (
              <div
                style={{
                  marginBottom: 16,
                  padding: 12,
                  borderRadius: 12,
                  background: "#dcfce7",
                  border: "1px solid #86efac",
                  color: "#166534",
                }}
              >
                {requestSuccess}
              </div>
            )}

            <button
              type="submit"
              disabled={requestLoading}
              style={{
                width: "100%",
                height: 46,
                border: "none",
                borderRadius: 12,
                background: requestLoading ? "#93c5fd" : "#2563eb",
                color: "#fff",
                fontSize: 16,
                fontWeight: 700,
                cursor: requestLoading ? "default" : "pointer",
              }}
            >
              {requestLoading ? "Отправка..." : "Отправить заявку"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}