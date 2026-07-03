import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PsychologyIcon from "@mui/icons-material/Psychology";
import RecordVoiceOverIcon from "@mui/icons-material/RecordVoiceOver";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Stack,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useReviewSprint } from "../../../../hooks/useReviewSprint";
import ListenButton from "./ListenButton";
import VoiceManager from "./VoiceManager";

function StatsRow({ stats, t }) {
  if (!stats) return null;
  return (
    <Stack direction="row" spacing={1} sx={{ justifyContent: "center", flexWrap: "wrap" }}>
      {stats.streak > 0 && <Chip size="small" color="primary" label={`🔥 ${stats.streak}`} />}
      <Chip size="small" label={`${t("review.tracked", "Tracked")}: ${stats.total ?? 0}`} />
      <Chip size="small" color="warning" label={`${t("review.due", "Due")}: ${stats.due ?? 0}`} />
      <Chip size="small" color="success" label={`${t("review.mastered", "Mastered")}: ${stats.mastered ?? 0}`} />
    </Stack>
  );
}

export default function ReviewSprint() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [voicesOpen, setVoicesOpen] = useState(false);
  const { status, current, index, total, revealed, reveal, rate, stats, reviewedCount, startSprint } =
    useReviewSprint();

  const isProduction = current?.direction === "production";
  // production: shown the meaning, recall the word. recognition: shown the word, recall the meaning.
  const prompt = current ? (isProduction ? current.translation : current.phrase) : "";
  const answer = current ? (isProduction ? current.phrase : current.translation) : "";
  const promptLabel = isProduction
    ? t("review.recallWord", "Recall the word")
    : t("review.recallMeaning", "Recall the meaning");

  const backButton = (
    <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/")} sx={{ alignSelf: "flex-start" }}>
      {t("review.backToGame", "Back to game")}
    </Button>
  );

  return (
    <Container maxWidth="sm" sx={{ py: 3 }}>
      <Stack spacing={2} sx={{ alignItems: "center" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, alignSelf: "center" }}>
          <PsychologyIcon color="primary" />
          <Typography variant="h5">{t("review.title", "Review sprint")}</Typography>
        </Box>

        {status === "loading" && <CircularProgress sx={{ my: 4 }} />}

        {status === "unauthenticated" && (
          <>
            <Typography color="text.secondary">
              {t("review.loginRequired", "Log in to review your words and track mastery.")}
            </Typography>
            {backButton}
          </>
        )}

        {status === "error" && (
          <>
            <Typography color="error">{t("review.error", "Could not load your reviews.")}</Typography>
            <Button variant="contained" onClick={startSprint}>
              {t("review.retry", "Try again")}
            </Button>
            {backButton}
          </>
        )}

        {status === "empty" && (
          <>
            <StatsRow stats={stats} t={t} />
            <Typography sx={{ mt: 2 }}>
              {t("review.nothingDue", "Nothing due right now — come back later! 🎉")}
            </Typography>
            {backButton}
          </>
        )}

        {status === "done" && (
          <>
            <StatsRow stats={stats} t={t} />
            <Typography variant="h6" sx={{ mt: 2 }}>
              {t("review.sprintDone", "Sprint complete!")}
            </Typography>
            <Typography color="text.secondary">
              {t("review.reviewedCount", "Reviewed {{count}} words", { count: reviewedCount })}
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button variant="contained" onClick={startSprint}>
                {t("review.reviewAgain", "Review more")}
              </Button>
              <Button onClick={() => navigate("/")}>{t("review.backToGame", "Back to game")}</Button>
            </Stack>
          </>
        )}

        {status === "active" && current && (
          <>
            <StatsRow stats={stats} t={t} />
            <Typography variant="caption" color="text.secondary">
              {index + 1} / {total}
            </Typography>

            <Card sx={{ width: "100%", textAlign: "center" }}>
              <CardContent>
                <Typography variant="overline" color="text.secondary">
                  {promptLabel}
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5, my: 2 }}>
                  <Typography variant="h4">{prompt}</Typography>
                  {/* recognition: the prompt is the target-language word */}
                  {!isProduction && <ListenButton text={current.phrase} lang={current.target_lang} t={t} />}
                </Box>
                {revealed && (
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5, mb: 1 }}>
                    <Typography variant="h5" color="primary">
                      {answer}
                    </Typography>
                    {/* production: the answer is the target-language word */}
                    {isProduction && <ListenButton text={current.phrase} lang={current.target_lang} t={t} />}
                  </Box>
                )}
              </CardContent>
            </Card>

            {!revealed ? (
              <Button variant="contained" size="large" onClick={reveal} sx={{ minWidth: 200 }}>
                {t("review.reveal", "Reveal")}
              </Button>
            ) : (
              <Stack direction="row" spacing={1} sx={{ justifyContent: "center" }}>
                <Button onClick={() => rate("again")} color="error" variant="outlined">
                  ❌ {t("training.didntKnow", "Didn’t know")}
                </Button>
                <Button onClick={() => rate("good")} color="warning" variant="outlined">
                  🤔 {t("training.shaky", "Shaky")}
                </Button>
                <Button onClick={() => rate("easy")} color="success" variant="contained">
                  ✅ {t("training.knewIt", "Knew it")}
                </Button>
              </Stack>
            )}
            {current.target_lang && (
              <Button size="small" startIcon={<RecordVoiceOverIcon />} onClick={() => setVoicesOpen(true)}>
                {t("review.voices", "Voice packs")}
              </Button>
            )}
            {backButton}
          </>
        )}
      </Stack>

      <VoiceManager
        open={voicesOpen}
        onClose={() => setVoicesOpen(false)}
        lang={current?.target_lang}
        sampleText={current?.phrase}
        t={t}
      />
    </Container>
  );
}
