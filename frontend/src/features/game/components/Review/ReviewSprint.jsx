import PsychologyIcon from "@mui/icons-material/Psychology";
import { Box, Container, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../../hooks/useAuth";
import GameHeader from "../GameHeader/GameHeader";
import ReviewSprintPanel from "./ReviewSprintPanel";

export default function ReviewSprint() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  return (
    <>
      <GameHeader handleLogoClick={() => navigate("/")} currentUser={currentUser} />
      <Container maxWidth="sm" sx={{ py: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, justifyContent: "center", mb: 2 }}>
          <PsychologyIcon color="primary" />
          <Typography variant="h5">{t("review.title", "Review sprint")}</Typography>
        </Box>
        <ReviewSprintPanel showBackToGame />
      </Container>
    </>
  );
}
