<#
.SYNOPSIS
    Renames a word throughout the codebase, handling case variants and pluralization.

.DESCRIPTION
    This script replaces all occurrences of a word with another word in:
    - File contents
    - File names
    - Folder names

    It automatically handles these case variants:
    - lowercase (word -> newword)
    - UPPERCASE (WORD -> NEWWORD)
    - PascalCase (Word -> Newword)
    - camelCase (word -> newword)
    - snake_case (old_word -> new_word)
    - SCREAMING_SNAKE_CASE (OLD_WORD -> NEW_WORD)
    - kebab-case (old-word -> new-word)
    - Title Case (Old Word -> New Word)

    And automatically handles singular/plural forms using common English rules.

.PARAMETER OldWord
    The word to find and replace (singular form). For multi-word input, use space-separated words.

.PARAMETER NewWord
    The replacement word (singular form). For multi-word input, use space-separated words.

.PARAMETER OldPlural
    Optional custom plural form for the old word. If not provided, auto-generated.

.PARAMETER NewPlural
    Optional custom plural form for the new word. If not provided, auto-generated.

.PARAMETER SingularOnly
    If specified, only replaces singular forms.

.PARAMETER PluralOnly
    If specified, only replaces plural forms.

.PARAMETER Path
    The root path to search. Defaults to current directory.

.PARAMETER FilePattern
    File patterns to include. Defaults to common code files.

.PARAMETER ExcludeDirs
    Directories to exclude from search.

.PARAMETER DryRun
    If specified, shows what would be changed without making changes.

.EXAMPLE
    .\Rename-Word.ps1 -OldWord "canvas" -NewWord "blueprint" -DryRun

.EXAMPLE
    .\Rename-Word.ps1 -OldWord "person" -NewWord "member" -OldPlural "people" -NewPlural "members"

.EXAMPLE
    .\Rename-Word.ps1 -OldWord "technical debt" -NewWord "tech liability" -Path "C:\Projects\MyApp"
#>

[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory = $true)]
    [string]$OldWord,

    [Parameter(Mandatory = $true)]
    [string]$NewWord,

    [Parameter()]
    [string]$OldPlural,

    [Parameter()]
    [string]$NewPlural,

    [Parameter()]
    [switch]$SingularOnly,

    [Parameter()]
    [switch]$PluralOnly,

    [Parameter()]
    [string]$Path = ".",

    [Parameter()]
    [string[]]$FilePattern = @("*.ts", "*.tsx", "*.js", "*.jsx", "*.json", "*.md", "*.sql", "*.css", "*.html", "*.yml", "*.yaml"),

    [Parameter()]
    [string[]]$ExcludeDirs = @("node_modules", ".git", "dist", "build", ".next", "coverage", ".turbo"),

    [Parameter()]
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

# Generate plural form using common English rules
function Get-PluralForm {
    param([string]$Word)

    $word = $Word.Trim().ToLower()

    # Common irregular plurals
    $irregulars = @{
        "person" = "people"
        "child"  = "children"
        "man"    = "men"
        "woman"  = "women"
        "foot"   = "feet"
        "tooth"  = "teeth"
        "goose"  = "geese"
        "mouse"  = "mice"
        "ox"     = "oxen"
        "index"  = "indices"
        "matrix" = "matrices"
        "vertex" = "vertices"
        "axis"   = "axes"
        "crisis" = "crises"
        "thesis" = "theses"
        "focus"  = "foci"
        "cactus" = "cacti"
        "datum"  = "data"
        "medium" = "media"
    }

    if ($irregulars.ContainsKey($word)) {
        return $irregulars[$word]
    }

    # Words ending in s, x, z, ch, sh -> add "es"
    if ($word -match '(s|x|z|ch|sh)$') {
        return $word + "es"
    }

    # Words ending in consonant + y -> change y to "ies"
    if ($word -match '[^aeiou]y$') {
        return $word.Substring(0, $word.Length - 1) + "ies"
    }

    # Words ending in f -> change f to "ves"
    if ($word -match '[^f]f$') {
        return $word.Substring(0, $word.Length - 1) + "ves"
    }

    # Words ending in fe -> change fe to "ves"
    if ($word -match 'fe$') {
        return $word.Substring(0, $word.Length - 2) + "ves"
    }

    # Words ending in o preceded by consonant -> add "es" (common cases)
    if ($word -match '[^aeiou]o$' -and $word -match '(hero|potato|tomato|echo|veto)$') {
        return $word + "es"
    }

    # Default: add "s"
    return $word + "s"
}

# Generate plural for multi-word phrase (pluralize last word)
function Get-PhrasePluralForm {
    param([string]$Phrase)

    $words = $Phrase.Trim() -split '\s+'
    if ($words.Count -eq 1) {
        return Get-PluralForm -Word $words[0]
    }

    # Pluralize the last word
    $lastWord = $words[-1]
    $pluralLast = Get-PluralForm -Word $lastWord
    $words[-1] = $pluralLast

    return $words -join " "
}

# Generate all case variants with explicit priority
# Returns array of PSCustomObjects with Key, Old, New, Priority
function Get-CaseVariantPairs {
    param(
        [string]$OldWords,
        [string]$NewWords
    )

    $oldParts = $OldWords.Trim().ToLower() -split '\s+'
    $newParts = $NewWords.Trim().ToLower() -split '\s+'

    $results = @()

    # Priority ordering (higher = process first within same length):
    # For separated variants (snake, kebab, title): SCREAMING > snake > kebab > Title
    # For concatenated variants: UPPER > Pascal > camel > lower

    # SCREAMING_SNAKE_CASE - highest priority for separated
    $results += [PSCustomObject]@{
        Key      = "SCREAMING_SNAKE_CASE"
        Old      = ($oldParts -join "_").ToUpper()
        New      = ($newParts -join "_").ToUpper()
        Priority = 90
    }

    # snake_case
    $results += [PSCustomObject]@{
        Key      = "snake_case"
        Old      = $oldParts -join "_"
        New      = $newParts -join "_"
        Priority = 80
    }

    # kebab-case
    $results += [PSCustomObject]@{
        Key      = "kebab-case"
        Old      = $oldParts -join "-"
        New      = $newParts -join "-"
        Priority = 70
    }

    # Title Case
    $results += [PSCustomObject]@{
        Key      = "Title Case"
        Old      = ($oldParts | ForEach-Object { $_.Substring(0,1).ToUpper() + $_.Substring(1) }) -join " "
        New      = ($newParts | ForEach-Object { $_.Substring(0,1).ToUpper() + $_.Substring(1) }) -join " "
        Priority = 60
    }

    # UPPERCASE (concatenated)
    $results += [PSCustomObject]@{
        Key      = "UPPERCASE"
        Old      = ($oldParts -join "").ToUpper()
        New      = ($newParts -join "").ToUpper()
        Priority = 50
    }

    # PascalCase - must come before camelCase
    $results += [PSCustomObject]@{
        Key      = "PascalCase"
        Old      = ($oldParts | ForEach-Object { $_.Substring(0,1).ToUpper() + $_.Substring(1) }) -join ""
        New      = ($newParts | ForEach-Object { $_.Substring(0,1).ToUpper() + $_.Substring(1) }) -join ""
        Priority = 40
    }

    # camelCase
    $results += [PSCustomObject]@{
        Key      = "camelCase"
        Old      = $oldParts[0] + (($oldParts | Select-Object -Skip 1 | ForEach-Object { $_.Substring(0,1).ToUpper() + $_.Substring(1) }) -join "")
        New      = $newParts[0] + (($newParts | Select-Object -Skip 1 | ForEach-Object { $_.Substring(0,1).ToUpper() + $_.Substring(1) }) -join "")
        Priority = 30
    }

    # lowercase
    $results += [PSCustomObject]@{
        Key      = "lowercase"
        Old      = $oldParts -join ""
        New      = $newParts -join ""
        Priority = 20
    }

    return $results
}

# Determine plural forms
$oldSingular = $OldWord.Trim().ToLower()
$newSingular = $NewWord.Trim().ToLower()

if ($OldPlural) {
    $oldPluralForm = $OldPlural.Trim().ToLower()
} else {
    $oldPluralForm = Get-PhrasePluralForm -Phrase $oldSingular
}

if ($NewPlural) {
    $newPluralForm = $NewPlural.Trim().ToLower()
} else {
    $newPluralForm = Get-PhrasePluralForm -Phrase $newSingular
}

# Generate variant pairs
$singularPairs = Get-CaseVariantPairs -OldWords $oldSingular -NewWords $newSingular
$pluralPairs = Get-CaseVariantPairs -OldWords $oldPluralForm -NewWords $newPluralForm

# Build combined replacement list with length info
$allReplacements = @()

if (-not $SingularOnly) {
    foreach ($pair in $pluralPairs) {
        $allReplacements += [PSCustomObject]@{
            Key      = "plural:$($pair.Key)"
            Old      = $pair.Old
            New      = $pair.New
            Length   = $pair.Old.Length
            Priority = $pair.Priority + 1000  # Plural always first (longer)
        }
    }
}

if (-not $PluralOnly) {
    foreach ($pair in $singularPairs) {
        $allReplacements += [PSCustomObject]@{
            Key      = "singular:$($pair.Key)"
            Old      = $pair.Old
            New      = $pair.New
            Length   = $pair.Old.Length
            Priority = $pair.Priority
        }
    }
}

# Sort: longest first, then by priority (higher first)
$sortedReplacements = $allReplacements | Sort-Object -Property @(
    @{Expression = {$_.Length}; Descending = $true},
    @{Expression = {$_.Priority}; Descending = $true}
)

# Remove duplicates using case-sensitive comparison (keep first = highest priority)
$seen = New-Object 'System.Collections.Generic.HashSet[string]'
$uniqueReplacements = @()
foreach ($r in $sortedReplacements) {
    if ($seen.Add($r.Old)) {  # Add returns true if item was added (not already present)
        $uniqueReplacements += $r
    }
}
$sortedReplacements = $uniqueReplacements

Write-Host "`n=== Word Rename Script ===" -ForegroundColor Cyan

Write-Host "`nSingular: " -ForegroundColor Yellow -NoNewline
Write-Host "$oldSingular -> $newSingular"
Write-Host "Plural:   " -ForegroundColor Yellow -NoNewline
Write-Host "$oldPluralForm -> $newPluralForm"

if ($SingularOnly) {
    Write-Host "`n[SINGULAR ONLY MODE]" -ForegroundColor Magenta
} elseif ($PluralOnly) {
    Write-Host "`n[PLURAL ONLY MODE]" -ForegroundColor Magenta
}

Write-Host "`nReplacement mappings (in order of application):" -ForegroundColor Yellow

$maxOldLen = ($sortedReplacements | ForEach-Object { $_.Old.Length } | Measure-Object -Maximum).Maximum
foreach ($r in $sortedReplacements) {
    $paddedOld = $r.Old.PadRight($maxOldLen)
    Write-Host "  $paddedOld -> $($r.New)" -ForegroundColor Gray
}

if ($DryRun) {
    Write-Host "`n[DRY RUN MODE - No changes will be made]" -ForegroundColor Magenta
}

$resolvedPath = Resolve-Path $Path
Write-Host "`nSearching in: $resolvedPath" -ForegroundColor Gray

# Track statistics
$stats = @{
    FilesModified     = 0
    FilesRenamed      = 0
    FoldersRenamed    = 0
    TotalReplacements = 0
}

# Step 1: Replace content in files
Write-Host "`n--- Phase 1: Replacing file contents ---" -ForegroundColor Cyan

$allFiles = @()
foreach ($pattern in $FilePattern) {
    $files = Get-ChildItem -Path $resolvedPath -Filter $pattern -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object {
            $fullPath = $_.FullName
            -not ($ExcludeDirs | Where-Object { $fullPath -like "*\$_\*" })
        }
    $allFiles += $files
}

$allFiles = $allFiles | Sort-Object FullName -Unique

foreach ($file in $allFiles) {
    try {
        $content = Get-Content -Path $file.FullName -Raw -ErrorAction SilentlyContinue
        if (-not $content) { continue }

        $originalContent = $content
        $replacementCount = 0

        foreach ($r in $sortedReplacements) {
            $pattern = [regex]::Escape($r.Old)
            $matches = [regex]::Matches($content, $pattern)
            $replacementCount += $matches.Count
            # Use -creplace for case-sensitive replacement
            $content = $content -creplace $pattern, $r.New
        }

        if ($content -ne $originalContent) {
            if ($DryRun) {
                Write-Host "  [WOULD MODIFY] $($file.FullName) ($replacementCount replacements)" -ForegroundColor Yellow
            } else {
                Set-Content -Path $file.FullName -Value $content -NoNewline
                Write-Host "  [MODIFIED] $($file.FullName) ($replacementCount replacements)" -ForegroundColor Green
            }
            $stats.FilesModified++
            $stats.TotalReplacements += $replacementCount
        }
    } catch {
        Write-Host "  [ERROR] $($file.FullName): $_" -ForegroundColor Red
    }
}

# Helper to check if name matches any variant
function Test-MatchesAnyVariant {
    param(
        [string]$Name,
        [array]$Replacements
    )
    foreach ($r in $Replacements) {
        if ($Name -match [regex]::Escape($r.Old)) {
            return $true
        }
    }
    return $false
}

# Helper to replace all variants in a name (case-sensitive)
function Get-RenamedName {
    param(
        [string]$Name,
        [array]$Replacements
    )
    $result = $Name
    foreach ($r in $Replacements) {
        $result = $result -creplace [regex]::Escape($r.Old), $r.New
    }
    return $result
}

# Step 2: Rename files
Write-Host "`n--- Phase 2: Renaming files ---" -ForegroundColor Cyan

$filesToRename = Get-ChildItem -Path $resolvedPath -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object {
        $fullPath = $_.FullName
        $matchesOld = Test-MatchesAnyVariant -Name $_.Name -Replacements $sortedReplacements
        $notExcluded = -not ($ExcludeDirs | Where-Object { $fullPath -like "*\$_\*" })
        $matchesOld -and $notExcluded
    } |
    Sort-Object { $_.FullName.Length } -Descending

foreach ($file in $filesToRename) {
    $newName = Get-RenamedName -Name $file.Name -Replacements $sortedReplacements

    if ($newName -ne $file.Name) {
        $newPath = Join-Path $file.DirectoryName $newName
        if ($DryRun) {
            Write-Host "  [WOULD RENAME] $($file.FullName)" -ForegroundColor Yellow
            Write-Host "             ->  $newPath" -ForegroundColor Yellow
        } else {
            Rename-Item -Path $file.FullName -NewName $newName
            Write-Host "  [RENAMED] $($file.FullName)" -ForegroundColor Green
            Write-Host "        ->  $newPath" -ForegroundColor Green
        }
        $stats.FilesRenamed++
    }
}

# Step 3: Rename folders
Write-Host "`n--- Phase 3: Renaming folders ---" -ForegroundColor Cyan

$foldersToRename = Get-ChildItem -Path $resolvedPath -Recurse -Directory -ErrorAction SilentlyContinue |
    Where-Object {
        $fullPath = $_.FullName
        $matchesOld = Test-MatchesAnyVariant -Name $_.Name -Replacements $sortedReplacements
        $notExcluded = -not ($ExcludeDirs | Where-Object { $fullPath -like "*\$_\*" })
        $matchesOld -and $notExcluded
    } |
    Sort-Object { $_.FullName.Length } -Descending

foreach ($folder in $foldersToRename) {
    $newName = Get-RenamedName -Name $folder.Name -Replacements $sortedReplacements

    if ($newName -ne $folder.Name) {
        $newPath = Join-Path $folder.Parent.FullName $newName
        if ($DryRun) {
            Write-Host "  [WOULD RENAME] $($folder.FullName)" -ForegroundColor Yellow
            Write-Host "             ->  $newPath" -ForegroundColor Yellow
        } else {
            Rename-Item -Path $folder.FullName -NewName $newName
            Write-Host "  [RENAMED] $($folder.FullName)" -ForegroundColor Green
            Write-Host "        ->  $newPath" -ForegroundColor Green
        }
        $stats.FoldersRenamed++
    }
}

# Summary
Write-Host "`n=== Summary ===" -ForegroundColor Cyan
Write-Host "Files modified:     $($stats.FilesModified)"
Write-Host "Files renamed:      $($stats.FilesRenamed)"
Write-Host "Folders renamed:    $($stats.FoldersRenamed)"
Write-Host "Total replacements: $($stats.TotalReplacements)"

if ($DryRun) {
    Write-Host "`nRun without -DryRun to apply changes." -ForegroundColor Magenta
}

Write-Host ""
