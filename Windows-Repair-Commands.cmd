@echo off
REM Commandes natives a lancer dans un terminal CMD ouvert en administrateur.
REM Elles sont separees du script PowerShell pour usage manuel controle.

echo === Verification image Windows ===
DISM /Online /Cleanup-Image /ScanHealth

echo === Reparation image Windows ===
DISM /Online /Cleanup-Image /RestoreHealth

echo === Verification fichiers systeme ===
sfc /scannow

echo === Verification logique du disque systeme sans redemarrage force ===
chkdsk C: /scan

echo === Optimisation composant store ===
DISM /Online /Cleanup-Image /StartComponentCleanup

echo === Liste des plans d'alimentation ===
powercfg /L

echo === Activation du plan Performances elevees ===
powercfg /S 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c

echo === Etats de veille disponibles ===
powercfg /a

echo === Rapport batterie ou energie si necessaire ===
powercfg /energy /duration 60
