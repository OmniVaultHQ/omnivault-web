"use client";

import { useFormStatus } from "react-dom";

export default function SubmitButton({
  children,
  loadingText = "Saving...",
  className = "",
}: {
  children: React.ReactNode;
  loadingText?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={className + (pending ? " opacity-60 cursor-not-allowed" : "")}
    >
      {pending ? loadingText : children}
    </button>
  );
}