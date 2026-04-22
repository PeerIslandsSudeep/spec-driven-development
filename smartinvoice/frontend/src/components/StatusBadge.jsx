import React from "react";

const LABELS = { draft: "Draft", pending: "Pending", paid: "Paid", overdue: "Overdue" };

export default function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{LABELS[status] || status}</span>;
}
