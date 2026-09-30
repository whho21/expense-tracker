import { useContext, useState } from "react";
import { Link, useNavigate } from "react-router";

import { TransactionContext } from "../contexts/TransactionContext";
import PageHeader from "../components/PageHeader";
import styles from "./NewTransaction.module.css";

// en-CA formats as YYYY-MM-DD in local time, matching the <input type="date"> value
const today = () => new Date().toLocaleDateString("en-CA");
const MAX_RECEIPT_SIZE = 4 * 1024 * 1024;

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read the selected image."));
    reader.readAsDataURL(file);
  });

function NewTransaction() {
  const { addTransaction, submitting, categories } =
    useContext(TransactionContext);
  const navigate = useNavigate();

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("expense");
  const [categoryId, setCategoryId] = useState("");
  const [date, setDate] = useState(today);
  const [error, setError] = useState(null);
  const [receiptError, setReceiptError] = useState(null);
  const [receiptMessage, setReceiptMessage] = useState("");
  const [parsingReceipt, setParsingReceipt] = useState(false);

  const typeCategories = categories.filter((c) => c.type === type);
  const selectedCategoryId = typeCategories.some((c) => c.id === categoryId)
    ? categoryId
    : (typeCategories[0]?.id ?? "");

  const handleReceiptUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setReceiptError(null);
    setReceiptMessage("");

    if (!file.type.startsWith("image/")) {
      setReceiptError("Choose an image file.");
      return;
    }
    if (file.size > MAX_RECEIPT_SIZE) {
      setReceiptError("The image must be 4 MB or smaller.");
      return;
    }

    setParsingReceipt(true);
    try {
      const fileData = await readFileAsDataUrl(file);
      const response = await fetch("/api/receipt/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileData, fileName: file.name }),
      });
      const receipt = await response.json();
      if (!response.ok) {
        throw new Error(receipt.error || "Receipt parsing failed.");
      }

      let extractedFields = 0;
      if (receipt.merchant) {
        setDescription(receipt.merchant.slice(0, 100));
        extractedFields += 1;
      }
      if (Number.isFinite(receipt.amount) && receipt.amount > 0) {
        setAmount(String(receipt.amount));
        extractedFields += 1;
      }
      if (typeof receipt.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(receipt.date)) {
        setDate(receipt.date);
        extractedFields += 1;
      }

      if (!extractedFields) {
        throw new Error("No merchant, total, or date was found in that receipt.");
      }
      setReceiptMessage("Receipt scanned. Review the details before saving.");
    } catch (err) {
      setReceiptError(err.message || "Receipt parsing failed.");
    } finally {
      setParsingReceipt(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (submitting) return;

    setError(null);

    const trimmed = description.trim();
    const numericAmount = Number(amount);

    if (!date) {
      setError("Please choose a date.");
      return;
    }
    if (!trimmed) {
      setError("Please enter a description.");
      return;
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Amount must be greater than 0.");
      return;
    }
    if (!selectedCategoryId) {
      setError("Please choose a category.");
      return;
    }

    // Start saving; the context handles success or rollback.
    void addTransaction({
      date,
      description: trimmed,
      categoryId: selectedCategoryId,
      amount: numericAmount,
    });

    navigate("/app/transactions");
  };

  return (
    <main className={styles.page}>
      <PageHeader
        eyebrow="Money movement"
        title="New Transaction"
        subtitle="Record a new income or expense."
      />

      <section className={styles.card} aria-label="New transaction form">
        {error && (
          <div className={styles.error} role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className={styles.receiptField}>
            <label className={styles.label} htmlFor="receipt-image">
              Receipt image
            </label>
            <input
              id="receipt-image"
              className={styles.input}
              type="file"
              accept="image/*"
              onChange={handleReceiptUpload}
              disabled={parsingReceipt}
            />
            {parsingReceipt && <p role="status">Scanning receipt…</p>}
            {receiptMessage && <p role="status">{receiptMessage}</p>}
            {receiptError && (
              <p className={styles.receiptError} role="alert">
                {receiptError}
              </p>
            )}
          </div>

          <div className={styles.grid}>
            <div className={`${styles.field} ${styles.fullWidth}`}>
              <label className={styles.label} htmlFor="description">
                Description
              </label>
              <input
                id="description"
                type="text"
                className={styles.input}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. NTUC FairPrice"
                maxLength={100}
                autoFocus
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="amount">
                Amount
              </label>
              <input
                id="amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                className={styles.input}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="date">
                Date
              </label>
              <input
                id="date"
                type="date"
                className={styles.input}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="type">
                Type
              </label>
              <select
                id="type"
                className={styles.input}
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="category">
                Category
              </label>
              <select
                id="category"
                className={styles.input}
                value={selectedCategoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                {typeCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.actions}>
            <Link to="/app/transactions" className={styles.cancelButton}>
              Cancel
            </Link>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={submitting || parsingReceipt}
            >
              {submitting
                ? "Saving…"
                : parsingReceipt
                  ? "Scanning receipt…"
                  : "Save Transaction"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

export default NewTransaction;
