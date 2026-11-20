# The Shell terminal's image (Settings > Integrations > Claude CLI > Shell). Same idea as a Gitpod workspace image: the tools are declared in the repo and BAKED IN, nothing is installed at run time.
#   build once:  docker compose -f test_harness/infra/docker-compose.yml build shell        (the page builds it for you the first time)
# FROM the agent image (node, pnpm, bun, claude, git, ripgrep) + the GitHub CLI (from GitHub's own apt repo, so it is current) + the packages listed in tools.apt.
FROM agent-testing-claude:1
USER root
COPY tools.apt /tmp/tools.apt
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl gnupg \
 && install -d -m 0755 /etc/apt/keyrings \
 && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg -o /etc/apt/keyrings/githubcli-archive-keyring.gpg \
 && chmod a+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
 && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" > /etc/apt/sources.list.d/github-cli.list \
 && apt-get update && apt-get install -y --no-install-recommends gh $(grep -v '^[[:space:]]*#' /tmp/tools.apt | tr '\n' ' ') \
 && rm -rf /var/lib/apt/lists/* /tmp/tools.apt \
 && gh --version | head -1 && jq --version && claude --version   # the build fails if one is missing
COPY entrypoint.sh /usr/local/bin/shell-entrypoint
RUN chmod +x /usr/local/bin/shell-entrypoint && mkdir -p /home/node && chown -R 1000:1000 /home/node
ENV HOME=/home/node
USER 1000:1000
WORKDIR /workspace
ENTRYPOINT ["/usr/local/bin/shell-entrypoint"]
CMD ["bash"]
