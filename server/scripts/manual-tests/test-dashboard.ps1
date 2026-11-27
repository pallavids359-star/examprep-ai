# --- Log in as Ravi ---
$body = @{ email = "ravi@test.com"; password = "test123" } | ConvertTo-Json
$login = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" -Method Post -Body $body -ContentType "application/json"
$headers = @{ Authorization = "Bearer $($login.token)" }
"Logged in as $($login.user.name)"

# --- Find NEET and its Physics chapters ---
$exams = (Invoke-RestMethod -Uri "http://localhost:5000/api/exams" -Headers $headers).exams
$neet = $exams | Where-Object code -eq "NEET"
$subjects = (Invoke-RestMethod -Uri "http://localhost:5000/api/exams/$($neet._id)/subjects" -Headers $headers).subjects
$physics = $subjects | Where-Object name -eq "Physics"
$chapters = (Invoke-RestMethod -Uri "http://localhost:5000/api/subjects/$($physics._id)/chapters" -Headers $headers).chapters
$units = $chapters | Where-Object name -eq "Units and Measurements"
$motion = $chapters | Where-Object name -eq "Motion in a Straight Line"

# --- Helper: start a practice, answer the same letter everywhere, submit ---
function Run-Practice($chapterId, $letter) {
  $start = @{ chapterId = $chapterId; difficulty = "any"; count = 5 } | ConvertTo-Json
  $p = Invoke-RestMethod -Uri "http://localhost:5000/api/attempts/practice" -Method Post -Body $start -ContentType "application/json" -Headers $headers
  $answers = @()
  foreach ($qq in $p.questions) {
    $answers += @{ questionId = $qq._id; selectedOptionIds = @($letter); timeSpentSec = 30 }
  }
  $submitBody = @{ answers = $answers } | ConvertTo-Json -Depth 5
  $s = Invoke-RestMethod -Uri "http://localhost:5000/api/attempts/$($p.attemptId)/submit" -Method Post -Body $submitBody -ContentType "application/json" -Headers $headers
  "   score $($s.result.score)/$($s.result.maxScore), accuracy $($s.result.accuracy)%"
}

"--- Practising Units and Measurements 3 times (answering A) ---"
Run-Practice $units._id "A"
Run-Practice $units._id "A"
Run-Practice $units._id "A"

"--- Practising Motion in a Straight Line once (answering C) ---"
Run-Practice $motion._id "C"

# --- Open the dashboard ---
$dash = Invoke-RestMethod -Uri "http://localhost:5000/api/progress/dashboard?examId=$($neet._id)" -Headers $headers

""
"=========== DASHBOARD ==========="
$dash.welcome
""
"--- TOTALS ---"
$dash.totals | Format-List
"--- STREAK ---"
"Current: $($dash.streak.current) day(s), Longest: $($dash.streak.longest)"
""
"--- WEAK CHAPTERS ---"
$dash.weakChapters | Select-Object name, attempted, correct, accuracy | Format-Table
"--- STRONG CHAPTERS ---"
$dash.strongChapters | Select-Object name, attempted, correct, accuracy | Format-Table
"--- RECOMMENDED ---"
$dash.recommended | Select-Object name, reason | Format-Table
"--- LAST 7 DAYS ---"
$dash.last7Days | Format-Table
"--- WRONG ANSWERS SAVED FOR REVISION: $($dash.wrongQuestionsCount) ---"
""
"--- RECENT TESTS ---"
$dash.recentTests | Select-Object mode, score, maxScore, accuracy | Format-Table