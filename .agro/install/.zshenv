if [ -r "${HOME}/.config/agro/langfuse.env" ]; then
  set -a
  . "${HOME}/.config/agro/langfuse.env"
  set +a
fi
