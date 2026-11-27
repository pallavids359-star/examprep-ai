$api = "http://localhost:5000/api"

function Login($email, $password) {
  $b = @{ email = $email; password = $password } | ConvertTo-Json
  $r = Invoke-RestMethod "$api/auth/login" -Method Post -Body $b -ContentType "application/json"
  return @{ Authorization = "Bearer $($r.token)" }
}

# ---------- ADMIN: create a mock test ----------
$admin = Login "manjula@test.com" "test123"
$neet = (Invoke-RestMethod "$api/exams" -Headers $admin).exams | Where-Object code -eq "NEET"
$physics = (Invoke-RestMethod "$api/exams/$($neet._id)/subjects" -Headers $admin).subjects | Where-Object name -eq "Physics"

$testBody = @{
  title = "NEET Physics Mini Mock"
  examId = $neet._id
  type = "subject"
  durationMinutes = 10
  maxAttempts = 2
  instructions = "10 questions in 10 minutes. +4 correct, -1 wrong."
  sections = @(@{ subjectId = $physics._id; count = 10 })
} | ConvertTo-Json -Depth 5
$created = Invoke-RestMethod "$api/admin/tests" -Method Post -Body $testBody -ContentType "application/json" -Headers $admin
$testId = $created.test._id
"TEST 1: $($created.message): $($created.test.totalQuestions) questions, $($created.test.totalMarks) marks"

$bad = @{ title = "Too big"; examId = $neet._id; durationMinutes = 10; sections = @(@{ subjectId = $physics._id; count = 500 }) } | ConvertTo-Json -Depth 5
try { Invoke-RestMethod "$api/admin/tests" -Method Post -Body $bad -ContentType "application/json" -Headers $admin | Out-Null }
catch { "TEST 2: $($_.ErrorDetails.Message)" }

# ---------- STUDENT 1: Ravi ----------
$ravi = Login "ravi@test.com" "test123"
$mine = (Invoke-RestMethod "$api/tests?examId=$($neet._id)" -Headers $ravi).tests | Where-Object _id -eq $testId
"TEST 3: Ravi sees '$($mine.title)', $($mine.durationMinutes) min, attempts used: $($mine.attemptsUsed)"

$start = Invoke-RestMethod "$api/tests/$testId/start" -Method Post -Headers $ravi
$again = Invoke-RestMethod "$api/tests/$testId/start" -Method Post -Headers $ravi
"TEST 4: starting again resumes the same attempt: $($start.attemptId -eq $again.attemptId)"

$attempt = Invoke-RestMethod "$api/attempts/$($start.attemptId)" -Headers $ravi
$left = [math]::Round(([datetime]$attempt.expiresAt - [datetime]$attempt.serverNow).TotalMinutes, 1)
"TEST 5: $($attempt.questions.Count) questions, $left minutes left"

$answers = @(); $i = 0
foreach ($q in $attempt.questions) {
  $answers += @{ questionId = $q._id; selectedOptionIds = @("B"); markedForReview = ($i -eq 0); timeSpentSec = 20 }
  $i++
}
$body = @{ answers = $answers } | ConvertTo-Json -Depth 5
$saved = Invoke-RestMethod "$api/attempts/$($start.attemptId)/answers" -Method Put -Body $body -ContentType "application/json" -Headers $ravi
$reopen = Invoke-RestMethod "$api/attempts/$($start.attemptId)" -Headers $ravi
$kept = @($reopen.savedAnswers | Where-Object { $_.selectedOptionIds -contains "B" }).Count
"TEST 6: autosave said '$($saved.message)'; answers kept after reopening: $kept of $($attempt.questions.Count)"

$res = Invoke-RestMethod "$api/attempts/$($start.attemptId)/submit" -Method Post -Body $body -ContentType "application/json" -Headers $ravi
"TEST 7: Ravi scored $($res.result.score)/$($res.result.maxScore), rank $($res.rank.rank) of $($res.rank.totalCandidates)"

# ---------- STUDENT 2: Asha ----------
$reg = @{ name = "Asha"; email = "asha@test.com"; password = "test123" } | ConvertTo-Json
try { Invoke-RestMethod "$api/auth/register" -Method Post -Body $reg -ContentType "application/json" | Out-Null } catch {}
$asha = Login "asha@test.com" "test123"
$s2 = Invoke-RestMethod "$api/tests/$testId/start" -Method Post -Headers $asha
$a2 = Invoke-RestMethod "$api/attempts/$($s2.attemptId)" -Headers $asha
$ans2 = @()
foreach ($q in $a2.questions) { $ans2 += @{ questionId = $q._id; selectedOptionIds = @("C"); timeSpentSec = 25 } }
$res2 = Invoke-RestMethod "$api/attempts/$($s2.attemptId)/submit" -Method Post -Body (@{ answers = $ans2 } | ConvertTo-Json -Depth 5) -ContentType "application/json" -Headers $asha
"TEST 8: Asha scored $($res2.result.score)/$($res2.result.maxScore), rank $($res2.rank.rank) of $($res2.rank.totalCandidates), percentile $($res2.rank.percentile)"

$raviNow = Invoke-RestMethod "$api/attempts/$($start.attemptId)" -Headers $ravi
"TEST 9: Ravi's rank is now $($raviNow.rank.rank) of $($raviNow.rank.totalCandidates)"

# ---------- Attempt limit (max 2) ----------
$s3 = Invoke-RestMethod "$api/tests/$testId/start" -Method Post -Headers $ravi
Invoke-RestMethod "$api/attempts/$($s3.attemptId)/submit" -Method Post -Body '{"answers":[]}' -ContentType "application/json" -Headers $ravi | Out-Null
try { Invoke-RestMethod "$api/tests/$testId/start" -Method Post -Headers $ravi | Out-Null; "TEST 10: FAILED, a third attempt was allowed" }
catch { "TEST 10: $($_.ErrorDetails.Message)" }