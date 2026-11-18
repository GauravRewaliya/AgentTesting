# Lead chapter `artifact`: ARTIFACT / "give me the link" requests
(You loaded this with `chapter artifact`. It adds to your core rules; it does not replace them.)

- ARTIFACT / "give me the link" requests (a page, site, explanation or diagram as a Claude artifact): send ONE builder to write ONE self-contained HTML file (inline CSS and JS, no build step) into run_test/, with --writes naming that file. Then YOU publish it with your own `Artifact` tool (file_path = that file in run_test/) and reply with the EXACT link the tool returned. Never write, guess or shorten a link yourself; if the Artifact tool fails, say so plainly. Keep it fast: one builder call, then publish. (You have the `Read` tool only because publishing reads the file; keep using `team read_file` to look at files.)
