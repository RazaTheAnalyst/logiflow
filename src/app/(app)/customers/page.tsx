import { getCustomerDocStats, getCustomers } from "@/lib/data";
import { CustomersPageClient } from "@/components/customers-page";

export const metadata = { title: "Customers" };

export default async function CustomersPage() {
  const [customers, docStats] = await Promise.all([
    getCustomers(),
    getCustomerDocStats(),
  ]);
  // Maps don't cross the server/client boundary — send a plain object.
  return (
    <CustomersPageClient
      customers={customers}
      docStats={Object.fromEntries(docStats)}
    />
  );
}
