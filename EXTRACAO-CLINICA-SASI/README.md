# EXTRACAO-CLINICA-SASI

**Sistema de Extração e Compilação de Dados Clínicos para UTI**
*Dr. Nicolas - Beneficência Portuguesa*

## Estrutura

```
EXTRACAO-CLINICA-SASI/
├── .github/workflows/validate.yml
├── data/
│   ├── processed/leitos/
│   ├── processed/compilado/
│   └── raw/README.md
├── docs/
│   ├── BRIEFING.md
│   ├── CONTRIBUTING.md
│   ├── mapa-folha.md
│   ├── README.md
│   └── STRUCTURE.md
├── output/evolucoes/16-08-2026/
├── scripts/
│   ├── build_passagem.py
│   ├── extract_ocr.py
│   ├── generate_output.py
│   ├── requirements.txt
│   └── validate_data.py
├── tests/test_build_passagem.py
└── LICENSE
```

## Uso

```bash
python scripts/build_passagem.py --file data/leito_01.json
python scripts/validate_data.py --directory data/processed/leitos/
python scripts/generate_output.py --input data/compilado/plantao.json --output output/evolucoes/16-08-2026/
```