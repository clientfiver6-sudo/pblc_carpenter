import { MedicalGate } from "@/components/medical/MedicalGate"

export default function MedicalLayout({ children }: { children: React.ReactNode }) {
  return <MedicalGate>{children}</MedicalGate>
}
