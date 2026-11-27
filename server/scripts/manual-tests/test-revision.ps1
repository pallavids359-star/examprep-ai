# --- Log in as Ravi ---
$body = @{ email = "ravi@test.com"; password = "test123" } | ConvertTo-Json
$login = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" -Method Post -Body $body -ContentType "application/json"
$headers = @{ Authorization = "Bearer $($login.token)" }
"Logged in as $($login.user.name)"

$exams = (Invoke-RestMethod -Uri "http://localhost:5000/api/exams" -Headers $headers).exams
$neet = $exams | Where-Object code -eq "NEET"

$before = (Invoke-RestMethod -Uri "http://localhost:5000/api/progress/dashboard?examId=$($neet._id)" -Headers $headers).wrongQuestionsCount
""
"=== WRONG-ANSWER PRACTICE ==="
"Wrong answers before: $before"

# --- TEST 1: Start wrong-answer practice ---
$start = @{ examId = $neet._id; count = 10 } | ConvertTo-Json
$wp = Invoke-RestMethod -Uri "http://localhost:5000/api/attempts/wrong-answers" -Method Post -Body $start -ContentType "application/json" -Headers $headers
"TEST 1: Got $($wp.totalQuestions) questions you got wrong before (mode: $($wp.mode))"
foreach ($qq in $wp.questions) { "   - $($qq.text)" }

# --- TEST 2: Answer C to all and submit ---
$answers = @()
foreach ($qq in $wp.questions) {
  $answers += @{ questionId = $qq._id; selectedOptionIds = @("C"); timeSpentSec = 30 }
}
$submitBody = @{ answers = $answers } | ConvertTo-Json -Depth 5
$res = Invoke-RestMethod -Uri "http://localhost:5000/api/attempts/$($wp.attemptId)/submit" -Method Post -Body $submitBody -ContentType "application/json" -Headers $headers
"TEST 2: Submitted. Correct this time: $($res.result.correct)"

$after = (Invoke-RestMethod -Uri "http://localhost:5000/api/progress/dashboard?examId=$($neet._id)" -Headers $headers).wrongQuestionsCount
"Wrong answers after: $after   (should be $before minus $($res.result.correct))"

""
"=== BOOKMARKS ==="
# --- TEST 3: Bookmark the first two questions ---
$q1 = $wp.questions[0]._id
$q2 = $wp.questions[1]._id
$b1 = @{ questionId = $q1; note = "Revise this formula" } | ConvertTo-Json
$b2 = @{ questionId = $q2 } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:5000/api/bookmarks" -Method Post -Body $b1 -ContentType "application/json" -Headers $headers | Out-Null
Invoke-RestMethod -Uri "http://localhost:5000/api/bookmarks" -Method Post -Body $b2 -ContentType "application/json" -Headers $headers | Out-Null
# Bookmark the first one AGAIN: must not create a duplicate
Invoke-RestMethod -Uri "http://localhost:5000/api/bookmarks" -Method Post -Body $b1 -ContentType "application/json" -Headers $headers | Out-Null

$list = Invoke-RestMethod -Uri "http://localhost:5000/api/bookmarks?examId=$($neet._id)" -Headers $headers
"TEST 3: Bookmarks saved: $($list.total)   (should be 2, no duplicate)"
foreach ($b in $list.bookmarks) { "   - $($b.question.text)   [note: $($b.note)]" }

# --- TEST 4: Practise only bookmarked questions ---
$bstart = @{ examId = $neet._id; count = 10 } | ConvertTo-Json
$bp = Invoke-RestMethod -Uri "http://localhost:5000/api/attempts/bookmarks" -Method Post -Body $bstart -ContentType "application/json" -Headers $headers
"TEST 4: Bookmark practice has $($bp.totalQuestions) questions (mode: $($bp.mode))"

# --- TEST 5: Remove one bookmark ---
Invoke-RestMethod -Uri "http://localhost:5000/api/bookmarks/$q2" -Method Delete -Headers $headers | Out-Null
$list2 = Invoke-RestMethod -Uri "http://localhost:5000/api/bookmarks?examId=$($neet._id)" -Headers $headers
"TEST 5: After removing one, bookmarks left: $($list2.total)   (should be 1)"