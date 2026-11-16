---
audience: dev
title: Infinite Heroes reference prompts (later real provider)
status: reference only · not used now
---
# Reference prompts for the later real provider (not used now)
> **Not part of the current build.** The current build has NO AI: [README](README.md) uses the seeded mock provider (`src/ai/provider.ts`). These are the exact prompts and model names of the analysed reference app, kept so a real provider can be dropped in later behind the same `generate(request)` seam (see README, *Later: Bring your own model*). Nothing here is installed, called or built now.

## Model and transport (reference)
- Model: `gemini-3-pro-image-preview` for beats, pictures and sidekick sheets. Server `resolveModel` only allowed names matching `^(models/)?(gemini-|imagen-|...)[a-zA-Z0-9._-]+$`.
- SDK `@google/genai@^1.29.0`, behind an Express route `POST /api/generate-content` (body limit 50 MB, photos are base64; `httpOptions`, `cachedContent`, `fileSearch` stripped from request bodies). The key came from `GEMINI_API_KEY` (or `API_KEY`) in the server process; none = HTTP 503.
- Key dialog copy of the reference: 'Secret Identity Required!' / 'Halt, Citizen! To access the infinite multiverse (and generate these amazing comics), you need a Paid API Key.' / tag 'Mission Briefing' / button 'Unlock The Multiverse' / 'ERROR_CODE: PAYWALL_VILLAIN_DETECTED'. Opened when the server answered 503 or the error text had `API_KEY_INVALID`, `Requested entity was not found` or `permission denied`.

## Beat request
`generateContent({model, contents: <prompt string>, config: {responseMimeType: 'application/json'}})`. Prompt (`${}` filled in): `You are writing a comic book script. PAGE ${n} of 10.` / `TARGET LANGUAGE FOR TEXT: ${langName} (CRITICAL: CAPTIONS, DIALOGUE, CHOICES MUST BE IN THIS LANGUAGE).` / `${coreDriver}` / `CHARACTERS: - HERO: Active. - CO-STAR: ${friendInstruction}` / `PREVIOUS PANELS (READ CAREFULLY):` + one line per earlier page `[Page n] [Focus: x] (Caption: "..") (Dialogue: "..") (Scene: ..) -> USER CHOICE: ".."` or `Start the adventure.` / RULES: 1 no repetition of earlier captions or dialogue; 2 if the co-star is active they must appear often; 3 variety (if page n-1 was action, make this a reaction or wide shot); 4 all user-facing text in `${langName}`; 5 avoid the words "co-star" and "hero" in captions / `INSTRUCTION: ${instruction}` / `OUTPUT STRICT JSON ONLY (No markdown formatting):` `{caption (${capLimit}), dialogue (${diaLimit}, optional), scene ("Vivid visual description (ALWAYS IN ENGLISH for the artist model). MUST mention 'HERO' or 'CO-STAR' if they are present."), focus_char: "hero"|"friend"|"other", choices: [2 options in ${langName}] (only if decision page)}`.
- `coreDriver` = `GENRE: ${genre}. TONE: ${tone}.`; Custom = `STORY PREMISE: ${premise or "A totally unique, unpredictable adventure"}. (Follow this premise strictly over standard genre tropes).`
- `friendInstruction`: no co-star = `Not yet introduced.`; else `ACTIVE and PRESENT (User Provided).` + (if the last focus was not the friend and `Math.random() > 0.4`) ` MANDATORY: FOCUS ON THE CO-STAR FOR THIS PANEL.` else ` Ensure they are woven into the scene even if not the main focus.`
- `instruction` = `Continue the story. ALL OUTPUT TEXT (Captions, Dialogue, Choices) MUST BE IN ${LANG}. ${coreDriver} ${guardrails}`. Guardrails: no Quantum/Timeline/Portal/Multiverse/Singularity jargon unless Dark Sci-Fi, Superhero or Custom; Comedy/Teen stakes are social, never life-or-death; no "The artifact"/"The device" unless set up earlier. Novel mode adds `RICH/NOVEL MODE ENABLED. Prioritize deeper character thoughts, descriptive captions, and meaningful dialogue exchanges over short punchlines.`
- Arc: page 1 INCITING INCIDENT; 2-4 RISING ACTION; 5-8 COMPLICATION (a twist); 9 CLIMAX; page 3 (decision) ends with a PSYCHOLOGICAL choice about values, relationships or risk, never 'Go Left'; page 10 FINAL PAGE, KARMIC CLIFFHANGER citing the page-3 choice, ends `TO BE CONTINUED...`.
- Word limits: Novel mode caption max 35, dialogue max 30; otherwise 15 and 12.
- Reply clean-up (the mock output must already satisfy it): strip ```json fences; parse; drop a leading `Name:` from dialogue and caption and quotes from dialogue; non-decision pages get `choices=[]`; a decision page with under 2 choices gets `["Option A","Option B"]`; a bad `focus_char` becomes `hero`.

## Picture request
`contents` = [text 'REFERENCE 1 [HERO]:', hero as `inlineData` `image/jpeg`, (if any) text 'REFERENCE 2 [CO-STAR]:', co-star image, final text], `config: {imageConfig: {aspectRatio: '2:3'}}`. Final text starts `STYLE: ${genre or "Modern American"} comic book art, detailed ink, vibrant colors. ` then:
- cover: `TYPE: Comic Book Cover. TITLE: "INFINITE HEROES" (OR LOCALIZED TRANSLATION IN ${LANG}). Main visual: Dynamic action shot of [HERO] (Use REFERENCE 1).`
- back cover: `TYPE: Comic Back Cover. FULL PAGE VERTICAL ART. Dramatic teaser. Text: "NEXT ISSUE SOON".`
- story: `TYPE: Vertical comic panel. SCENE: ${scene}. INSTRUCTIONS: Maintain strict character likeness. If scene mentions 'HERO', you MUST use REFERENCE 1. If scene mentions 'CO-STAR' or 'SIDEKICK', you MUST use REFERENCE 2.` + ` INCLUDE CAPTION BOX: "${caption}"` + ` INCLUDE SPEECH BUBBLE: "${dialogue}"`.
- The answer part `inlineData` becomes `data:${mime};base64,...`.

## Sidekick sheet (when the beat says `friend` and no co-star was uploaded)
`STYLE: Masterpiece ${genre} comic character sheet, detailed ink, neutral background. FULL BODY. Character: A fitting sidekick for this story`, aspect 1:1.

## Fallback beat (beat call failed)
`{caption: "It began..." (page 1) or "...", scene: "Generic scene for page N.", focus_char: "hero", choices: []}`.
