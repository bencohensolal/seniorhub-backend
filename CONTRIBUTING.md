# CONTRIBUTING.md

## Commit format

Use Commitizen-style messages:

- `type(name): summary`
- blank line
- short description paragraph

Allowed types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`.

## Mandatory checks before commit

1. Refresh AGENTS proof:

```bash
python3 scripts/agents_proof.py --refresh
```

2. Run API quality checks:

```bash
npm run quality:check
```

3. Ensure documentation consistency:

```bash
python3 scripts/docs_guard.py
```

## Pre-commit hooks

Install and enable hooks:

```bash
python3 -m pip install --user pre-commit
pre-commit install --install-hooks --hook-type pre-commit --hook-type commit-msg
```

## Documentation policy

When architecture, workflows, or transversal directives change, update in the same work cycle:

- `AGENTS.md`
- `ARCHITECTURE.md`
- `README.md`
- `CHANGELOG.md`
- `TODO.md`
- `IDEAS.md`
