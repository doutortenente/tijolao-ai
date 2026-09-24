#!/usr/bin/env bash
# Instala os wrappers versionados deste repo em ~/.local/bin.
# Idempotente: rode de novo depois de um git pull.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mkdir -p ~/.local/bin

for w in "$DIR"/wrappers/*; do
  nome="$(basename "$w")"
  install -m 0755 "$w" ~/.local/bin/"$nome"
  echo "  ~/.local/bin/$nome"
done

install -m 0755 /dev/stdin ~/.local/bin/tijolao <<SH
#!/usr/bin/env bash
exec "$DIR/tijolao.sh" "\$@"
SH
echo "  ~/.local/bin/tijolao"
echo
echo "Pronto. Ligue com:  tijolao up"
