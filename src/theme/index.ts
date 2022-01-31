// theme.js
import { extendTheme } from "@chakra-ui/react";
// Foundational style overrides
import typography from "./foundations/typography";
import Alert from "./components/alert";

// Component style overrides

const theme = extendTheme({
  initialColorMode: "light",
  useSystemColorMode: false,
  ...typography,
  // Other foundational style overrides go here
  components: {
    Alert,
  },
});
export default theme;
