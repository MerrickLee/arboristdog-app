import { create } from 'zustand';

interface LocationData {
  address: string;
  propertyType: 'residential' | 'commercial';
  coordinates?: { lat: number; lng: number };
}

export interface DiagnosisResult {
  condition_name: string;
  confidence: number;
  severity: 'low' | 'moderate' | 'high';
  explanation: string;
  actions: Array<{ priority: string; text: string; color?: string }>;
}

interface DiagnosisState {
  capturedImage: string | null;
  selectedTags: string[];
  description: string;
  location: LocationData | null;
  result: DiagnosisResult | null;
  
  setCapturedImage: (uri: string) => void;
  setContext: (tags: string[], desc: string) => void;
  setLocation: (loc: LocationData) => void;
  setResult: (res: DiagnosisResult) => void;
  resetSession: () => void;
}

export const useDiagnosisStore = create<DiagnosisState>((set) => ({
  capturedImage: null,
  selectedTags: [],
  description: '',
  location: null,
  result: null,

  setCapturedImage: (uri) => set({ capturedImage: uri }),
  setContext: (tags, description) => set({ selectedTags: tags, description }),
  setLocation: (location) => set({ location }),
  setResult: (result) => set({ result }),
  resetSession: () => set({
    capturedImage: null,
    selectedTags: [],
    description: '',
    location: null,
    result: null,
  }),
}));
