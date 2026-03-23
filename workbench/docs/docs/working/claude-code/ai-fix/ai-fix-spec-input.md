The goal is to provide an efficient workflow for resolving security findings. To do this, it will be necessary to take a holistic view of the security findings, so that easy to repair items, can be addressed quickly, and more sistemic findings that are harder / riskier to repair can be addressed seprately. Each will benefit from a different kind of analysis to accelerate remediation.

To begin, we need to introduce the concept of a repairability triage analysis. This should have visual charts communicating KPIs about the findings. This view need not be for each scan, it can be a singular view representing the state of the latest findings in the repo.

"As a user I would like to have a view that will tell me per severity, how many findings should be supressed, how many findings are an easy fix (non-risky, probably ~1 file), and how many vulnerabilties are more sistemic, and would required more in depth out of application analysis, possibly using a coding agent directly. These insights should be driven by AI."

"As a user, for findings that should be supressed, I would like to have a clear explanation of what the issues is, the risk, and why it can be safely supressed. I want the option to be able to easily supress the finding with the push of a button, and have that supression be written immediately, and the status updated in the interface."

"As a user, for findings that are an easy fix (non-risky, probably ~1 file), I would like to have a clear explanation of what the issues is, the risk, and how it can be easily fixed, with a code sample. I want the option to be able to easily fix the finding with the push of a button, and have that fix be written immediately, and the status updated in the interface. 'Fix applied, status will be updated next scan' "

"As a user, for findings that are harder or more risky to fix, I would like to have a clear explanation of what the issues is, the risk, and why it's hard to fix. I want comprehensive repair guidance to be generated, in such detail that it can guide further analysis and action in an outside coding agent. The detail should be easily copied to the clipboard for portability"

When drilling down into a severity/repairability combination, I should see a list of those findings filtered for severity and category. This will allow the user to address those findings easy to repair, quickly. The interface should be updated so it's easy to see what's been addressed, so that a large number of findings canbe worked through in a sistematic manner.

For the POC, only High severity findings not supressed should be analyzed. If a finding has not changed and has already been analyzed it need not be analyzed again. 
