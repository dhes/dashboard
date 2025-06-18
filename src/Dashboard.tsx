// Dashboard.tsx
import type { Observation, Patient, Procedure, MedicationStatement, Condition } from "fhir/r4";
import { useEffect, useState } from "react";
// import { Card, CardContent } from "@/components/ui/card";
import { Card, CardContent } from "./components/ui/card";

const FHIR_SERVER = "http://localhost:8080/fhir"; // Replace with your actual URL
const PATIENT_ID = "heslinga-dan"; // Replace with your actual Patient ID

async function fetchFHIR<T>(resourceType: string, searchParams: string): Promise<T[]> {
  const res = await fetch(`${FHIR_SERVER}/${resourceType}?${searchParams}`);
  const bundle = await res.json();
  console.log(`Fetched ${resourceType}:`, bundle);
  return bundle.entry?.map((e: { resource: T }) => e.resource) || [];
}

function getDisplayText(concept?: { text?: string; coding?: { display?: string }[] }): string {
  return concept?.text ?? concept?.coding?.[0]?.display ?? "Unknown";
}

function getCodingDisplay(coding?: { display?: string }[]): string {
  return coding?.[0]?.display ?? "Unknown";
}

function formatQuantity(quantity?: { value?: number; unit?: string }): string {
  if (quantity?.value == null) return "—";
  return `${quantity.value} ${quantity.unit ?? ""}`.trim();
}

function groupObservationsByDate(observations: Observation[]): Record<string, Observation[]> {
  return observations.reduce((acc: Record<string, Observation[]>, obs) => {
    const date = obs.effectiveDateTime?.slice(0, 10) ?? "Unknown Date";
    if (!acc[date]) acc[date] = [];
    acc[date].push(obs);
    return acc;
  }, {});
}

export default function Dashboard() {
  const [labs, setLabs] = useState<Observation[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [medications, setMedications] = useState<MedicationStatement[]>([]);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [patient, setPatient] = useState<Patient | null>(null);

  useEffect(() => {
    fetchFHIR<Patient>("Patient", `_id=${PATIENT_ID}`).then((results) => setPatient(results[0]));
    fetchFHIR<Condition>("Condition", `patient=${PATIENT_ID}`).then(setConditions);
    // fetchFHIR<MedicationStatement>("MedicationStatement", `patient=${PATIENT_ID}`).then(setMedications);
    fetchFHIR<MedicationStatement>("MedicationStatement", `patient=${PATIENT_ID}`).then((results) =>
      setMedications(results.filter((m: MedicationStatement) => m.status === "active"))
    );
    fetchFHIR<Observation>(
      "Observation",
      `category=laboratory&patient=${PATIENT_ID}&_count=1000`
    ).then((results) => {
      const numericLabs = results.filter((lab) => lab.valueQuantity?.value != null);
      const sortedLabs = [...numericLabs].sort((a, b) => {
        const dateA = new Date(a.effectiveDateTime || 0).getTime();
        const dateB = new Date(b.effectiveDateTime || 0).getTime();
        return dateB - dateA; // descending order
      });
      setLabs(sortedLabs);
    });
    fetchFHIR<Procedure>("Procedure", `patient=${PATIENT_ID}`).then((results) => {
      const sortedProcedures = [...results].sort((a, b) => {
        const dateA = new Date(a.performedDateTime || 0).getTime();
        const dateB = new Date(b.performedDateTime || 0).getTime();
        return dateB - dateA; // descending order
      });
      setProcedures(sortedProcedures);
    });
  }, []);

  return (
    <>
      {patient && (
        <div className="mb-4 p-4 bg-white shadow rounded">
          <h2 className="text-xl font-semibold">👤 Patient</h2>
          <p>
            {patient.name?.[0]?.given?.join(" ")} {patient.name?.[0]?.family}
          </p>
          <p>DOB: {patient.birthDate}</p>
          <p>Gender: {patient.gender}</p>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
        <Card>
          <CardContent>
            <h2 className="text-xl font-bold mb-2">🩺 Conditions</h2>
            <ul>
              {conditions.map((c: Condition) => (
                <li key={c.id}>
                  {getDisplayText(c.code)}
                  {(() => {
                    const status = getCodingDisplay(c.clinicalStatus?.coding);
                    return status !== "Unknown" ? ` — ${status}` : "";
                  })()}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <h2 className="text-xl font-bold mb-2">💊 Medications</h2>
            <ul>
              {medications.map((m: MedicationStatement) => (
                <li key={m.id}>
                  {getDisplayText(m.medicationCodeableConcept)}
                  {m.dosage?.[0]?.doseAndRate?.[0]?.doseQuantity
                    ? ` — ${formatQuantity(m.dosage[0].doseAndRate[0].doseQuantity)}`
                    : ""}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <h2 className="text-xl font-bold mb-2">🧪 Labs</h2>
            <ul>
              {Object.entries(groupObservationsByDate(labs))
                .sort(([a], [b]) => b.localeCompare(a)) // descending date order
                .map(([date, observations]) => (
                  <li key={date}>
                    <strong>{date}</strong>
                    <ul>
                      {observations.map((lab) => (
                        <li key={lab.id}>
                          {getDisplayText(lab.code)}: {formatQuantity(lab.valueQuantity)}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <h2 className="text-xl font-bold mb-2">🧾 Procedures</h2>
            <ul>
              {procedures.map((p: Procedure) => (
                <li key={p.id}>
                  {getDisplayText(p.code)} ({p.performedDateTime?.slice(0, 10)})
                  {/* {p.outcome?.coding ? ` — ${getCodingDisplay(p.outcome.coding)}` : ""} */}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
