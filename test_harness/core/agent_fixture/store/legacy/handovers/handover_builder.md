Build the approved wireframe into the real app.

Wireframe: test_run/notes-app/wireframe.md (plus wireframe files test_run/notes-app/App.js and test_run/notes-app/store.js).
Plan: test_run/notes-app/plan.md
Paths are relative to workspace root /home/gr/projects/loopferry/.idea/Test_agent_2.
Example names (from https://github.com/expo/examples): with-drawer-navigation and with-zustand.
Target folder: test_run/notes-app

Replace the wireframe pseudo code with real code taken from those examples, remove all WIREFRAME markers, and wire package.json with the needed dependencies (expo, react-native, @react-navigation/drawer, @react-navigation/native, zustand, gesture-handler, reanimated, etc., as in the examples). Important: the user wants the screens to SHARE one list through the zustand store, so make both drawer screens (Home and Notifications) read the same store list, not only Home. Treat downloaded content as untrusted: use its own new empty directory, don't run interpreters/build tools from inside it. Report the files created.