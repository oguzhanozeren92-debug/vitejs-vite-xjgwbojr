export type ModelEngineRollout =
  | 'off'
  | 'shadow'
  | 'pilot'
  | 'production';

export type ModelEngineKey =
  | 'pyfao56'
  | 'pcse'
  | 'aquacrop'
  | 'autogeobound'
  | 'openagri-pest-disease'
  | 'agml'
  | 'farmvibes-ai';

export type ModelEngineRegistryEntry = {
  key: ModelEngineKey;
  role: string;
  rollout: ModelEngineRollout;
  upstreamRepo: string;
  upstreamCommit: string;
  license: string;
  productionAuthority: boolean;
};

export const MODEL_ENGINE_REGISTRY: Record<
  ModelEngineKey,
  ModelEngineRegistryEntry
> = {
  pyfao56: {
    key: 'pyfao56',
    role: 'irrigation_water_balance',
    rollout: 'shadow',
    upstreamRepo: 'kthorp/pyfao56',
    upstreamCommit: '1d242ee985be0edbc4946f06e7e94a487d4bc0c9',
    license: 'CC0-1.0 / public domain dedication',
    productionAuthority: false,
  },
  pcse: {
    key: 'pcse',
    role: 'crop_phenology_growth',
    rollout: 'pilot',
    upstreamRepo: 'ajwdewit/pcse',
    upstreamCommit: '67a28e56b0e34655f8d60b0b4a254a7c81efbb2f',
    license: 'EUPL-1.1-or-later-compatible',
    productionAuthority: false,
  },
  aquacrop: {
    key: 'aquacrop',
    role: 'seasonal_irrigation_yield_scenarios',
    rollout: 'pilot',
    upstreamRepo: 'aquacropos/aquacrop',
    upstreamCommit: '36cc20e44644ed1704398889312435c85e04a2f3',
    license: 'Apache-2.0',
    productionAuthority: false,
  },
  autogeobound: {
    key: 'autogeobound',
    role: 'automatic_field_boundary_research',
    rollout: 'off',
    upstreamRepo: 'agstack/autogeobound',
    upstreamCommit: '7087b59e51438ec370b698186805751be9296ec2',
    license: 'Apache-2.0',
    productionAuthority: false,
  },
  'openagri-pest-disease': {
    key: 'openagri-pest-disease',
    role: 'pest_disease_risk_benchmark',
    rollout: 'off',
    upstreamRepo: 'agstack/OpenAgri-PestAndDiseaseManagement',
    upstreamCommit: '3aa67a9ad3de6ff8a772dc635db041ec53845aa4',
    license: 'EUPL-1.2',
    productionAuthority: false,
  },
  agml: {
    key: 'agml',
    role: 'disease_vision_research',
    rollout: 'off',
    upstreamRepo: 'Project-AgML/AgML',
    upstreamCommit: 'c3343fc3b3f8abd89983927da3fc8319cb019d49',
    license: 'Apache-2.0',
    productionAuthority: false,
  },
  'farmvibes-ai': {
    key: 'farmvibes-ai',
    role: 'geospatial_pipeline_reference',
    rollout: 'off',
    upstreamRepo: 'microsoft/farmvibes-ai',
    upstreamCommit: 'd10670e18742d05aec50f73e4695d47978908994',
    license: 'MIT',
    productionAuthority: false,
  },
};

export function modelEngineEnabled(key: ModelEngineKey) {
  return MODEL_ENGINE_REGISTRY[key].rollout !== 'off';
}
