import { Box } from "@mui/material";
import PropTypes from "prop-types";

/**
 * A field no person can fill in, so anything that arrives in it came from a script.
 *
 * Hidden three ways on purpose. `aria-hidden` and `tabIndex={-1}` keep it out of the
 * accessibility tree and the tab order, so screen-reader and keyboard users never meet it —
 * an "invisible" honeypot that only hides visually is a trap for exactly the people least
 * able to recover from it. The CSS moves it off-screen rather than using `display: none` or
 * `type="hidden"`, both of which the better bots know to skip.
 */
export default function HoneypotField({ name, value, onChange }) {
  return (
    <Box
      aria-hidden="true"
      sx={{
        position: "absolute",
        width: 1,
        height: 1,
        overflow: "hidden",
        clip: "rect(0 0 0 0)",
        whiteSpace: "nowrap",
      }}
    >
      <label htmlFor={name}>Leave this field empty</label>
      <input
        id={name}
        name={name}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        tabIndex={-1}
        autoComplete="off"
      />
    </Box>
  );
}

HoneypotField.propTypes = {
  name: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
};
