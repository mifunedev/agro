# shellcheck shell=sh
if [ -n "${OPENSHELL_SANDBOX:-}" ] && [ -r /etc/agro/image-environment ]; then
  while IFS= read -r agro_image_env; do
    export "${agro_image_env?}"
  done < /etc/agro/image-environment
  unset agro_image_env
fi
