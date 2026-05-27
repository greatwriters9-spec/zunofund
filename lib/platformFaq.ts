export type PlatformFaq = {
  id: string;
  question: string;
  answer: string;
  sort_order: number;
  is_active: boolean;
  updated_at?: string | null;
};

export const DEFAULT_PLATFORM_FAQS: PlatformFaq[] = [
  {
    id: "default-withdrawals",
    question: "How long do withdrawals take?",
    answer:
      "Withdrawal processing times depend on verification and blockchain confirmation speed. Most requests are processed within a short timeframe after approval.",
    sort_order: 0,
    is_active: true,
  },
  {
    id: "default-availability",
    question: "Is investor support available every day?",
    answer:
      "Yes. Our support team operates 24/7 to ensure continuous assistance for investors worldwide.",
    sort_order: 1,
    is_active: true,
  },
  {
    id: "default-investing",
    question: "How do I begin investing?",
    answer:
      "Create an account, choose your preferred investment plan, and proceed with your deposit request through the secure investor dashboard.",
    sort_order: 2,
    is_active: true,
  },
];

function toFaq(row: Partial<PlatformFaq>, fallbackOrder: number): PlatformFaq | null {
  const question = String(row.question ?? "").trim();
  const answer = String(row.answer ?? "").trim();
  if (!question || !answer) return null;

  const sortOrder = Number(row.sort_order);
  return {
    id: String(row.id ?? `faq-${fallbackOrder}`),
    question,
    answer,
    sort_order: Number.isFinite(sortOrder) ? sortOrder : fallbackOrder,
    is_active: row.is_active !== false,
    updated_at: row.updated_at ?? null,
  };
}

export function normalizePlatformFaqRows(
  rows: Partial<PlatformFaq>[] | null | undefined,
): PlatformFaq[] {
  return (rows ?? [])
    .map((row, index) => toFaq(row, index))
    .filter((row): row is PlatformFaq => row !== null)
    .sort((a, b) => a.sort_order - b.sort_order || a.question.localeCompare(b.question));
}
