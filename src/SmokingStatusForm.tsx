// SmokingStatusForm.tsx
import { useState } from 'react';
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography
} from '@mui/material';

const smokingOptions = [
  { code: "266927001", display: "Current every day smoker" },
  { code: "8517006", display: "Former smoker" },
  { code: "266919005", display: "Never smoked tobacco (finding)" },
  { code: "266928000", display: "Unknown if ever smoked" }
];

const SmokingStatusForm = () => {
  const [smokingCode, setSmokingCode] = useState('');

  const handleSubmit = () => {
    const selectedOption = smokingOptions.find(option => option.code === smokingCode);

    const observation = {
      resourceType: "Observation",
      status: "final",
      meta: {
        profile: [
          "http://hl7.org/fhir/us/core/StructureDefinition/us-core-smokingstatus"
        ]
      },
      category: [
        {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/observation-category",
              code: "social-history",
              display: "Social History"
            }
          ],
          text: "Social History"
        }
      ],
      code: {
        coding: [
          {
            code: "72166-2",
            system: "http://loinc.org",
            display: "Tobacco smoking status"
          }
        ],
        text: "Tobacco smoking status"
      },
      subject: {
        reference: "Patient/heslinga-dan",
        display: "Dan Heslinga"
      },
      effectiveDateTime: new Date().toISOString(),
      valueCodeableConcept: {
        coding: [
          {
            code: smokingCode,
            system: "http://snomed.info/sct",
            display: selectedOption?.display || ""
          }
        ],
        text: selectedOption?.display || ""
      },
      performer: [
        {
          reference: "Practitioner/heslinga-dan",
          display: "Dan Heslinga"
        }
      ]
    };

    console.log("FHIR Smoking Observation:", observation);
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Smoking Status
      </Typography>
      <FormControl fullWidth>
        <InputLabel id="smoking-status-label">Smoking Status</InputLabel>
        <Select
          labelId="smoking-status-label"
          value={smokingCode}
          label="Smoking Status"
          onChange={(e) => setSmokingCode(e.target.value)}
        >
          {smokingOptions.map(option => (
            <MenuItem key={option.code} value={option.code}>
              {option.display}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <Button
        sx={{ mt: 2 }}
        variant="contained"
        onClick={handleSubmit}
        disabled={!smokingCode}
      >
        Submit
      </Button>
    </Box>
  );
};

export default SmokingStatusForm;